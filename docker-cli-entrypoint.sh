#!/bin/sh
# CLI runner for Docker - bypasses the normal server entrypoint

set -e

# Ensure we're in the right directory
cd /app

# Run the command passed as arguments
exec "$@"

