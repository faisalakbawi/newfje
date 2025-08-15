#!/bin/bash
# Kill existing bot
pkill -f "node main-bot.js" 2>/dev/null || true
sleep 1

# Start bot with logging to file
cd /Users/faisal/Desktop/base-volume-bot
node main-bot.js > live_debug.log 2>&1 &

# Get PID
BOT_PID=$!
echo "Bot started with PID: $BOT_PID"

# Tail the log file
tail -f live_debug.log