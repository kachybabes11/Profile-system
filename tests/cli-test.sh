#!/bin/bash

# CLI Test Script for Profile Intelligence System
# Run with: ./tests/cli-test.sh

set -e

echo "🧪 Testing Profile Intelligence CLI"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

function log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

function assert() {
    local condition=$1
    local message=$2
    ((TESTS_RUN++))
    if [ "$condition" = true ]; then
        ((TESTS_PASSED++))
        echo -e "${GREEN}✅ PASS: $message${NC}"
    else
        ((TESTS_FAILED++))
        echo -e "${RED}❌ FAIL: $message${NC}"
    fi
}

function test_cli_installed() {
    log "Testing CLI installation..."
    if command -v insighta &> /dev/null; then
        assert true "CLI is installed and available"
    else
        assert false "CLI is not installed. Run: npm install -g insighta-cli"
        return 1
    fi
}

function test_cli_help() {
    log "Testing CLI help command..."
    local output
    output=$(insighta --help 2>&1)
    if [[ $output == *"Insighta Labs CLI"* ]]; then
        assert true "CLI help displays correctly"
    else
        assert false "CLI help not working properly"
    fi
}

function test_cli_version() {
    log "Testing CLI version..."
    local output
    output=$(insighta --version 2>&1 || true)
    if [[ $output == *"1.0.0"* ]]; then
        assert true "CLI version displays correctly"
    else
        assert false "CLI version not working"
    fi
}

function test_cli_not_logged_in() {
    log "Testing CLI behavior when not logged in..."

    # Remove any existing credentials for clean test
    rm -f ~/.insighta/credentials.json

    local output
    output=$(insighta me 2>&1 || true)
    if [[ $output == *"Not logged in"* ]]; then
        assert true "CLI correctly detects not logged in state"
    else
        assert false "CLI should detect not logged in state"
    fi
}

function test_cli_login_dry_run() {
    log "Testing CLI login command (dry run)..."

    # This will fail because we can't actually complete OAuth in test
    # But we can verify the command exists and starts the flow
    local output
    timeout 5 insighta login 2>&1 || true

    # Check if it attempted to start the login process
    if [[ $output == *"Opening browser"* ]] || [[ $output == *"Waiting for OAuth"* ]]; then
        assert true "CLI login command starts OAuth flow"
    else
        assert false "CLI login command not working"
    fi
}

function test_cli_list_without_auth() {
    log "Testing CLI list command without authentication..."

    local output
    output=$(insighta list 2>&1 || true)
    if [[ $output == *"Not logged in"* ]] || [[ $output == *"Token expired"* ]]; then
        assert true "CLI list requires authentication"
    else
        assert false "CLI list should require authentication"
    fi
}

function test_cli_export_without_auth() {
    log "Testing CLI export command without authentication..."

    local output
    output=$(insighta export 2>&1 || true)
    if [[ $output == *"Not logged in"* ]] || [[ $output == *"Token expired"* ]]; then
        assert true "CLI export requires authentication"
    else
        assert false "CLI export should require authentication"
    fi
}

function test_cli_create_without_auth() {
    log "Testing CLI create command without authentication..."

    local output
    output=$(insighta create "Test User" 2>&1 || true)
    if [[ $output == *"Not logged in"* ]] || [[ $output == *"Token expired"* ]]; then
        assert true "CLI create requires authentication"
    else
        assert false "CLI create should require authentication"
    fi
}

function test_cli_role_command() {
    log "Testing CLI role command..."

    # Create fake credentials for testing
    mkdir -p ~/.insighta
    echo '{"user":{"role":"analyst"},"access_token":"fake"}' > ~/.insighta/credentials.json

    local output
    output=$(insighta role 2>&1 || true)
    if [[ $output == *"analyst"* ]]; then
        assert true "CLI role command shows user role"
    else
        assert false "CLI role command not working"
    fi

    # Clean up
    rm -f ~/.insighta/credentials.json
}

function cleanup() {
    log "Cleaning up test artifacts..."
    rm -f ~/.insighta/credentials.json
    rm -rf ~/.insighta/
}

function show_summary() {
    echo
    echo "=================================="
    echo "🧪 CLI Test Summary"
    echo "=================================="
    echo "Tests Run: $TESTS_RUN"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All CLI tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}💥 $TESTS_FAILED CLI tests failed${NC}"
        exit 1
    fi
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run tests
test_cli_installed
test_cli_help
test_cli_version
test_cli_not_logged_in
test_cli_login_dry_run
test_cli_list_without_auth
test_cli_export_without_auth
test_cli_create_without_auth
test_cli_role_command

# Show summary
show_summary</content>
<parameter name="filePath">c:\Users\Laura\OneDrive\Desktop\Profile system\tests\cli-test.sh