#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/server" && node index.js &
sleep 1
cd "$DIR" && npx vite --open &
sleep 3
open "http://localhost:5173/financial-planner/"
echo ""
echo "✅ 家庭财务规划师已启动"
echo "🌐 http://localhost:5173/financial-planner/"
echo "按 Ctrl+C 关闭"
trap "kill 0" INT TERM
wait
