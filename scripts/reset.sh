#!/usr/bin/env bash
set -e

# remove pds data directory
pushd packages/danaus > /dev/null
rm -r data || true
popd > /dev/null

# reset docker containers with volumes
pushd packages/dev-env > /dev/null
docker compose down -v || true
popd > /dev/null

echo "done"
