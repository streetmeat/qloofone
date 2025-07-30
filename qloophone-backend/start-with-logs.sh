#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

LOG_FILE="server-full.log"

echo -e "${GREEN}🚀 Starting QlooPhone Backend with Full Logging${NC}"
echo "Logs will be saved to: $LOG_FILE"
echo "Press Ctrl+C to stop"
echo ""

# Create or clear the log file
> $LOG_FILE

# Start the server and capture all output
npm run dev 2>&1 | tee -a $LOG_FILE