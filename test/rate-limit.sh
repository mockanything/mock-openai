#!/usr/bin/env bash
set -e

echo "=== flash 模型：连续发 25 个请求，应观察到 20 个 200 + 5 个 429 ==="
for i in $(seq 1 25); do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"x"}],"model":"apple-v1-flash"}')
  echo "Request $i: $status"
done

echo ""
echo "=== pro 模型：连续发 65 个请求，应观察到 60 个 200 + 5 个 429 ==="
for i in $(seq 1 65); do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"x"}],"model":"apple-v1-pro"}')
  echo "Request $i: $status"
done

echo ""
echo "=== 查看 429 响应体 ==="
curl -s -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"x"}],"model":"apple-v1-flash"}' | head -c 200
echo ""

echo ""
echo "=== 查看 rate limit 响应头 ==="
curl -sI -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"x"}],"model":"apple-v1-flash"}'
