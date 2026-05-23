#!/usr/bin/env bash
# ── Marketing Agent – one-command launcher ──────────────────────────────────
# Usage:  ./start.sh [--api-key sk-ant-...]
# The Anthropic API key can also be pre-set in backend/.env

set -e
cd "$(dirname "$0")"

# ── Parse --api-key flag ─────────────────────────────────────────────────────
API_KEY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key) API_KEY="$2"; shift 2;;
    *) shift;;
  esac
done

# ── Write .env if a key was supplied ─────────────────────────────────────────
if [[ -n "$API_KEY" ]]; then
  echo "PORT=5000" > backend/.env
  echo "ANTHROPIC_API_KEY=$API_KEY" >> backend/.env
  echo "UPLOAD_DIR=./uploads" >> backend/.env
  echo "✓  API key written to backend/.env"
fi

# ── Ensure backend/.env exists ───────────────────────────────────────────────
if [[ ! -f backend/.env ]]; then
  echo "❌  backend/.env not found."
  echo "    Run:  ./start.sh --api-key sk-ant-..."
  echo "    Or create backend/.env with:"
  echo "      PORT=5000"
  echo "      ANTHROPIC_API_KEY=sk-ant-..."
  echo "      UPLOAD_DIR=./uploads"
  exit 1
fi

# ── Install dependencies ──────────────────────────────────────────────────────
echo "📦  Installing backend dependencies…"
cd backend && npm install --silent 2>/dev/null | tail -1

# ── Build frontend into backend/public (only when needed) ────────────────────
if [[ ! -f public/index.html ]]; then
  echo "🔨  Building frontend (first run – takes ~30 s)…"
  npm run build:full
else
  echo "✓  Frontend already built (delete backend/public to rebuild)"
fi

# ── Start ─────────────────────────────────────────────────────────────────────
echo ""
echo "🚀  Starting Marketing Agent on http://localhost:5000"
echo "    Press Ctrl+C to stop."
echo ""
npm start
