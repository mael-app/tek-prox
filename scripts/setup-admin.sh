#!/bin/bash
# Setup script to create an admin group and assign it to a user

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Tek-Prox Setup - Create Admin Group for User${NC}\n"

# Check if node_modules exists and ts-node is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx is not available. Please ensure Node.js is installed.${NC}"
    exit 1
fi

# Run the TypeScript setup script
echo -e "${YELLOW}Running setup script...${NC}\n"
npx ts-node scripts/setup-admin.ts

