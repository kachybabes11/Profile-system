#!/usr/bin/env node

/**
 * Basic Test Runner for Profile Intelligence System
 * Run with: node tests/basic-test.js
 */

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'https://profile-system-production.up.railway.app';

// Test results
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function assert(condition, message) {
  testsRun++;
  if (condition) {
    testsPassed++;
    log(`✅ PASS: ${message}`, 'success');
  } else {
    testsFailed++;
    log(`❌ FAIL: ${message}`, 'error');
  }
}

async function testHealthEndpoint() {
  try {
    log('Testing health endpoint...');
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    assert(response.status === 200, 'Health endpoint returns 200');
    assert(response.data.status === 'ok', 'Health endpoint returns correct status');
  } catch (error) {
    assert(false, `Health endpoint test failed: ${error.message}`);
  }
}

async function testCORSHeaders() {
  try {
    log('Testing CORS headers...');
    const response = await axios.options(`${BASE_URL}/api/profiles`, {
      headers: {
        'Origin': 'https://profile-system-production.up.railway.app',
        'Access-Control-Request-Method': 'GET'
      }
    });

    const corsHeaders = [
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers'
    ];

    corsHeaders.forEach(header => {
      assert(response.headers[header] !== undefined, `CORS header ${header} present`);
    });

  } catch (error) {
    assert(false, `CORS test failed: ${error.message}`);
  }
}

async function testAPIVersionEnforcement() {
  try {
    log('Testing API version enforcement...');
    // Test without X-API-Version header
    try {
      await axios.get(`${BASE_URL}/api/profiles`);
      assert(false, 'Should require X-API-Version header');
    } catch (error) {
      assert(error.response?.status === 400, 'Returns 400 without X-API-Version header');
    }

  } catch (error) {
    assert(false, `API version test failed: ${error.message}`);
  }
}

async function testAuthenticationRequired() {
  try {
    log('Testing authentication requirements...');
    const endpoints = [
      '/api/profiles',
      '/api/profiles/search',
      '/auth/me'
    ];

    for (const endpoint of endpoints) {
      try {
        await axios.get(`${BASE_URL}${endpoint}`, {
          headers: { 'X-API-Version': '1' }
        });
        assert(false, `${endpoint} should require authentication`);
      } catch (error) {
        assert(error.response?.status === 401, `${endpoint} returns 401 without auth`);
      }
    }

  } catch (error) {
    assert(false, `Authentication test failed: ${error.message}`);
  }
}

async function testRateLimiting() {
  try {
    log('Testing rate limiting...');
    const requests = [];

    // Make multiple requests to auth endpoint
    for (let i = 0; i < 15; i++) {
      requests.push(
        axios.get(`${BASE_URL}/auth/github`)
          .catch(error => error)
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(response =>
      response.response?.status === 429
    );

    assert(rateLimited, 'Rate limiting activates after multiple requests');

  } catch (error) {
    assert(false, `Rate limiting test failed: ${error.message}`);
  }
}

async function runTests() {
  log('🚀 Starting Profile Intelligence System Tests', 'info');
  log(`Base URL: ${BASE_URL}`, 'info');
  log('─'.repeat(50), 'info');

  // Run all tests
  await testHealthEndpoint();
  await testCORSHeaders();
  await testAPIVersionEnforcement();
  await testAuthenticationRequired();
  await testRateLimiting();

  // Summary
  log('─'.repeat(50), 'info');
  log(`Test Results: ${testsRun} total, ${testsPassed} passed, ${testsFailed} failed`, 'info');

  if (testsFailed === 0) {
    log('🎉 All tests passed!', 'success');
    process.exit(0);
  } else {
    log(`💥 ${testsFailed} tests failed`, 'error');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Profile Intelligence System - Basic Test Runner

Usage: node tests/basic-test.js [options]

Options:
  --help, -h    Show this help message

Environment Variables:
  BASE_URL      API base URL (default: https://profile-system-production.up.railway.app)

Examples:
  node tests/basic-test.js
  BASE_URL=http://localhost:3000 node tests/basic-test.js
  `);
  process.exit(0);
}

// Run tests
runTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});