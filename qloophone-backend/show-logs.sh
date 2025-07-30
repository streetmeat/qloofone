#!/bin/bash

# Simple script to capture logs from tmux session

LOG_FILE="backend-logs.txt"
SESSION_NAME="qloo-backend"

# Check if tmux session exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "📝 Capturing logs from tmux session: $SESSION_NAME"
    
    # Capture last 3000 lines from tmux
    tmux capture-pane -t $SESSION_NAME -p -S -3000 > $LOG_FILE
    
    echo "✅ Logs saved to: $LOG_FILE"
    echo "📏 Captured $(wc -l < $LOG_FILE) lines"
    echo ""
    echo "Last 10 lines:"
    echo "=============="
    tail -10 $LOG_FILE
else
    echo "❌ No tmux session found named: $SESSION_NAME"
    echo ""
    echo "Start your backend with:"
    echo "  tmux new -s $SESSION_NAME"
    echo "  PUBLIC_URL=<ngrok-url> npm run dev"
    echo ""
    echo "Then detach with: Ctrl+B, D"
fi