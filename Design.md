# Insighta Labs+ System Evolution Design

## Overview

This document outlines the evolution of the existing Profile Intelligence System to handle growth from 1M+ records and hundreds of queries/minute to 10M+ records and 10,000+ queries/minute while maintaining reliability and backward compatibility.

## 1. Requirements

### Functional Requirements

**Core Functionality (Existing + Enhanced)**
- **FR1**: Store and retrieve profile data (name, gender, age, country)
- **FR2**: Support natural language search queries with filters (gender, age ranges, country)
- **FR3**: Bulk CSV data ingestion with validation and deduplication
- **FR4**: Role-based access control (admin: full access, analyst: read-only)
- **FR5**: OAuth authentication (GitHub) for CLI and web clients
- **FR6**: Pagination for large result sets
- **FR7**: Export profiles to CSV format

**Growth Requirements**
- **FR8**: Handle 10M+ profile records
- **FR9**: Process 10,000+ queries/minute
- **FR10**: Support concurrent bulk uploads (up to 500k rows each)
- **FR11**: Maintain data consistency during high-write scenarios
- **FR12**: Provide query performance monitoring and analytics

### Non-Functional Requirements

**Performance**
- **NFR1**: Query response time < 200ms (p95) for simple queries
- **NFR2**: Query response time < 500ms (p95) for complex filtered queries
- **NFR3**: CSV ingestion rate > 5,000 rows/second sustained
- **NFR4**: Support 1,000+ concurrent users

**Scalability**
- **NFR5**: Horizontal scaling capability (add servers without downtime)
- **NFR6**: Database read throughput > 50,000 queries/minute
- **NFR7**: Storage capacity for 100M+ records
- **NFR8**: Handle traffic spikes (2x normal load for 15 minutes)

**Reliability**
- **NFR9**: 99.9% uptime (8.76 hours downtime/year)
- **NFR10**: Data durability (no permanent data loss)
- **NFR11**: Graceful degradation under load
- **NFR12**: Automatic recovery from failures

**Consistency**
- **NFR13**: Strong consistency for user authentication and authorization
- **NFR14**: Eventual consistency acceptable for profile data (max 30s lag)
- **NFR15**: Atomic bulk operations (CSV uploads succeed or fail completely)

**Security**
- **NFR16**: Maintain existing security model (JWT, RBAC, CSRF protection)
- **NFR17**: Rate limiting prevents abuse (100 req/min per user)
- **NFR18**: Data encryption at rest and in transit

**Maintainability**
- **NFR19**: Backward compatibility with existing API contracts
- **NFR20**: Monitoring and alerting for performance degradation
- **NFR21**: Deployment without downtime (rolling updates)

## 2. Architecture

### High-Level Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │  API Gateway    │    │  Redis Cache    │
│   (Nginx/HAProxy)│    │  (Express.js)   │    │  (Cluster)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
          ┌─────────┴─────────┐    ┌──────────┴──────────┐
          │   Application     │    │   PostgreSQL       │
          │   Servers         │    │   Database         │
          │   (Node.js)       │    │   (Primary +       │
          │                   │    │    Replicas)       │
          └───────────────────┘    └─────────────────────┘
                    │
          ┌─────────┴─────────┐
          │   Background      │
          │   Workers         │
          │   (CSV Processing)│
          └───────────────────┘
```

### Component Responsibilities

**Load Balancer**
- Distributes traffic across application servers
- SSL termination
- Health checks and failover

**API Gateway (Application Servers)**
- Request routing and authentication
- Rate limiting and security
- Query parsing and caching coordination
- CSV upload coordination

**Redis Cache Cluster**
- Query result caching
- Session storage
- Rate limiting data
- Background job queues

**PostgreSQL Database**
- Primary: Write operations, authentication
- Read replicas: Query operations
- Partitioned tables for large datasets

**Background Workers**
- Asynchronous CSV processing
- Data validation and transformation
- Bulk insert operations

### Component Interactions

1. **Client Request Flow**: Load Balancer → API Server → Cache Check → Database → Response
2. **CSV Upload Flow**: API Server → Queue Job → Background Worker → Database
3. **Cache Invalidation**: Database Write → Cache Clear Signal → Redis Update
4. **Health Monitoring**: All components report metrics to monitoring system

## 3. Data Flow

### Data Ingestion Pipeline

```
CSV File → Load Balancer → API Server → Validation → Queue → Worker → Batch Insert → Success Response
     ↓           ↓            ↓          ↓         ↓         ↓           ↓
  Client     Rate Limit    Header Check  Redis   Process   Database   Client
```

**Detailed Flow**:
1. **Client Upload**: Multipart file upload with authentication
2. **Initial Validation**: File size, type, header validation (sync)
3. **Queue Job**: Store file reference in Redis queue
4. **Background Processing**: Worker streams file, validates rows, batches inserts
5. **Database Operations**: Bulk inserts with conflict resolution
6. **Progress Updates**: Real-time status via WebSocket/polling
7. **Completion**: Cache invalidation, cleanup, final response

### Query Processing Pipeline

```
Natural Language Query → Load Balancer → API Server → Parse → Cache Check → Database → Format → Response
         ↓                      ↓            ↓         ↓          ↓         ↓        ↓
      Client               Auth Check    Normalize  Redis     Replica    JSON     Client
```

**Detailed Flow**:
1. **Query Reception**: Authenticated request with natural language query
2. **Parsing**: Extract filters, normalize query for caching
3. **Cache Lookup**: Check Redis for normalized query key
4. **Database Query**: Execute on read replica with optimized indexes
5. **Result Processing**: Apply pagination, format response
6. **Cache Storage**: Store result with TTL
7. **Response**: JSON with metadata (total count, pagination links)

### Result Delivery

**Synchronous Responses**:
- Simple queries: Direct JSON response
- Complex queries: Paginated JSON with HATEOAS links

**Asynchronous Responses**:
- Large result sets: Pre-signed S3 URLs for CSV exports
- Bulk operations: Job status with completion callbacks

## 4. Design Decisions

### Decision 1: Read Replicas + Primary Database (Maps to NFR5, NFR6, NFR9)
**Choice**: PostgreSQL with 1 primary + 3 read replicas
**Rationale**: Separates read/write workloads, enables horizontal scaling
**Trade-off**: Eventual consistency (acceptable per NFR14) vs strong consistency complexity
**Implementation**: Connection routing based on query type (read vs write)

### Decision 2: Redis Cluster for Caching (Maps to NFR1, NFR2, NFR8)
**Choice**: Redis cluster with 3 nodes instead of in-memory NodeCache
**Rationale**: Survives server restarts, enables horizontal scaling, handles cache misses better
**Trade-off**: Network latency vs memory speed (acceptable for <1ms Redis latency)
**Implementation**: Cache-aside pattern with 15-minute TTL, LRU eviction

### Decision 3: Background Workers for CSV Processing (Maps to NFR3, NFR10, NFR15)
**Choice**: Dedicated worker processes using Redis queues
**Rationale**: Prevents blocking API servers during large uploads, enables parallel processing
**Trade-off**: Added complexity vs synchronous processing (necessary for scale)
**Implementation**: Bull queue library, 5 concurrent workers per server

### Decision 4: Database Partitioning (Maps to NFR7, NFR6)
**Choice**: Hash partitioning by country_id for profiles table
**Rationale**: Distributes data evenly, enables parallel queries, improves cache locality
**Trade-off**: Complex queries across partitions vs single-table performance
**Implementation**: PostgreSQL native partitioning, partition-aware query routing

### Decision 5: Load Balancer with Session Affinity (Maps to NFR13, NFR16)
**Choice**: Nginx with IP-hash load balancing
**Rationale**: Maintains session consistency for authentication flows
**Trade-off**: Uneven load distribution vs session consistency (acceptable for <10% variance)
**Implementation**: Cookie-based session affinity with Redis backing

### Decision 6: Monitoring-First Design (Maps to NFR20, NFR21)
**Choice**: Structured logging + metrics collection at every layer
**Rationale**: Enables proactive scaling, bottleneck identification, zero-downtime deployments
**Trade-off**: Development overhead vs operational visibility (critical for scale)
**Implementation**: Prometheus metrics, structured JSON logs, health check endpoints

## 5. Trade-offs and Limitations

### Performance Limitations
- **Cold Cache Performance**: Initial queries after cache misses may exceed 500ms target
- **Cross-Partition Queries**: Complex queries spanning multiple countries slower due to partition overhead
- **Bulk Upload Throughput**: Limited by single background worker per server (5,000 rows/sec max per server)

### Scalability Limitations
- **Database Vertical Scaling**: PostgreSQL partitioning has practical limits (~100 partitions)
- **Redis Memory Pressure**: Large result sets may cause cache eviction storms
- **Worker Queue Bottleneck**: Redis queue becomes single point of failure under extreme load

### Consistency Limitations
- **Read Replica Lag**: Up to 30 seconds lag acceptable but may show stale data during spikes
- **Cache Invalidation Race**: Brief period of stale cache data during concurrent writes
- **Partial Upload Visibility**: CSV upload progress not visible across server restarts

### Operational Limitations
- **Deployment Complexity**: Rolling updates require careful orchestration to maintain sessions
- **Debugging Difficulty**: Distributed tracing adds latency and complexity
- **Cost Scaling**: Redis cluster and read replicas increase infrastructure costs linearly

### Intentional Simplifications
- **No Microservices**: Monolithic architecture maintained for simplicity and backward compatibility
- **No Advanced Caching**: HTTP caching layers omitted to keep API contract simple
- **No Real-time Features**: WebSocket support deferred until real-time requirements emerge
- **No Multi-region**: Single-region deployment assumes global users accept regional latency

## Optional: Future Evolution

### Real-Time Analytics Support
**Current Gap**: System provides static query results with caching
**Evolution Path**:
1. **Streaming Pipeline**: Add Kafka/Redis Streams for real-time data ingestion
2. **Materialized Views**: Pre-compute aggregations (gender distribution, age demographics)
3. **WebSocket API**: Push updates for dashboard clients
4. **Time-Series Storage**: InfluxDB for historical analytics data

**Implementation**: Start with Redis Streams for event sourcing, add WebSocket endpoints for subscriptions

### Natural Language Query System
**Current Gap**: Rule-based parsing with limited flexibility
**Evolution Path**:
1. **Intent Classification**: ML model to classify query types (demographic, geographic, temporal)
2. **Entity Extraction**: Named entity recognition for countries, age ranges, attributes
3. **Query Expansion**: Synonym handling and fuzzy matching
4. **Feedback Loop**: User corrections improve model accuracy
5. **Hybrid Approach**: Rule-based fallback for edge cases

**Implementation**: Start with fine-tuned BERT model for intent classification, maintain rule-based system as fallback

This design provides a clear, practical path for scaling the existing system while maintaining reliability and backward compatibility. Each decision is justified by specific requirements and includes explicit trade-off awareness.</content>
<parameter name="filePath">c:\Users\Laura\OneDrive\Desktop\Profile system\Design.md