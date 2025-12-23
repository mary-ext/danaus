#!/usr/bin/env bash
set -e

# start infrastructure if not already running
pushd "$(dirname "$0")" > /dev/null
docker compose up -d --wait
popd > /dev/null

# set environment variables for the child process
export DB_POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/danaus"
export REDIS_HOST="localhost:6379"

# run the provided command via mise to ensure bun is available
exec mise exec -- "$@"
