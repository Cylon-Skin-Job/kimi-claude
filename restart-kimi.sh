#!/bin/bash
# Restart script for Kimi IDE with Thread Management
# Run this after any code changes before testing

set -e  # Exit on any error

# Kill existing server
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 1

# Build frontend (fails loudly if TypeScript errors)
cd ~/projects/kimi-claude/kimi-ide-client && npm run build

# Start server (serves both API + frontend from dist/)
cd ~/projects/kimi-claude/kimi-ide-server && node server.js &
sleep 2

echo "READY - Refresh browser now"
echo "http://localhost:3001"
