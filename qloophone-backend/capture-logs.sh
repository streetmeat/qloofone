#!/bin/bash

# This script captures recent backend logs from the terminal buffer
# You need to run the backend in a screen or tmux session for this to work

echo "📋 Backend Log Capture Options:"
echo ""
echo "1. If using screen:"
echo "   - Start backend: screen -S qloo-backend"
echo "   - Inside screen: PUBLIC_URL=<NGROK_URL> npm run dev"
echo "   - Detach: Ctrl+A, D"
echo "   - Capture logs: screen -S qloo-backend -X hardcopy -h screen-logs.txt"
echo ""
echo "2. If using tmux:"
echo "   - Start backend: tmux new -s qloo-backend"
echo "   - Inside tmux: PUBLIC_URL=<NGROK_URL> npm run dev" 
echo "   - Detach: Ctrl+B, D"
echo "   - Capture logs: tmux capture-pane -t qloo-backend -p > tmux-logs.txt"
echo ""
echo "3. Manual copy (simplest):"
echo "   - Just copy the terminal output and save to a file"
echo "   - Then I can read that file"
echo ""

# Try to capture from common session names
if screen -list | grep -q "qloo-backend"; then
    echo "Found screen session 'qloo-backend', capturing..."
    screen -S qloo-backend -X hardcopy -h captured-logs.txt
    echo "Logs saved to: captured-logs.txt"
elif tmux list-sessions 2>/dev/null | grep -q "qloo-backend"; then
    echo "Found tmux session 'qloo-backend', capturing..."
    tmux capture-pane -t qloo-backend -p > captured-logs.txt
    echo "Logs saved to: captured-logs.txt"
else
    echo "No screen/tmux session found named 'qloo-backend'"
    echo "You can manually copy terminal output to a file and I can read it"
fi