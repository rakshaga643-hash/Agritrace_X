#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  AgriTraceX — One-Command Production Launcher
#  Usage: bash start.sh
# ═══════════════════════════════════════════════════════════

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[AgriTraceX]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       AgriTraceX Production Launcher         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Kill occupied ports safely ────────────────────────────────────────────
kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    warn "Killed existing process on port $port"
    sleep 1
  fi
}

log "Clearing ports 3000 and 5050..."
kill_port 3000
kill_port 5050

# ── 2. Check Node.js ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  err "Node.js not found. Install from https://nodejs.org"
  exit 1
fi
log "Node.js $(node --version) ✅"

# ── 3. Check Python ───────────────────────────────────────────────────────────
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON="$cmd"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  warn "Python not found — camera.py will not start"
else
  log "Python $($PYTHON --version 2>&1) ✅"
  # Install Python deps if missing (use python3 -m pip, never bare pip)
  $PYTHON -m pip install flask opencv-python piexif flask-cors --quiet --disable-pip-version-check 2>/dev/null || \
    warn "Some Python packages may be missing — camera features may fail"
fi

# ── 4. Install Node dependencies ──────────────────────────────────────────────
if [ ! -d node_modules ]; then
  log "Installing Node.js dependencies..."
  npm install --silent
fi

# ── 5. Start Node.js backend ──────────────────────────────────────────────────
log "Starting Node.js backend on port 3000..."
node start.js > /tmp/agritracex-node.log 2>&1 &
NODE_PID=$!
echo $NODE_PID > /tmp/agritracex-node.pid

# Wait for backend to be ready
for i in $(seq 1 20); do
  if curl -s http://localhost:3000 >/dev/null 2>&1; then
    log "Backend ready ✅  http://localhost:3000"
    break
  fi
  sleep 1
done

# ── 6. Start Python camera server ─────────────────────────────────────────────
if [ -n "$PYTHON" ] && [ -f camera.py ]; then
  log "Starting OBS camera server on port 5050..."
  $PYTHON camera.py > /tmp/agritracex-camera.log 2>&1 &
  CAM_PID=$!
  echo $CAM_PID > /tmp/agritracex-camera.pid
  sleep 3
  if curl -s http://localhost:5050/status >/dev/null 2>&1; then
    log "Camera server ready ✅  http://localhost:5050/stream"
  else
    warn "Camera server starting... (check OBS Virtual Camera is enabled)"
  fi
fi

# ── 7. Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           AgriTraceX is LIVE! 🚀             ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Dashboard : http://localhost:3000           ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Camera    : http://localhost:5050/stream    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  IoT API   : http://localhost:3000/api/iot   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Node log  : /tmp/agritracex-node.log        ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "Press Ctrl+C to stop all services"

# ── 8. Graceful shutdown ──────────────────────────────────────────────────────
cleanup() {
  echo ""
  warn "Shutting down..."
  [ -f /tmp/agritracex-node.pid ]   && kill "$(cat /tmp/agritracex-node.pid)"   2>/dev/null || true
  [ -f /tmp/agritracex-camera.pid ] && kill "$(cat /tmp/agritracex-camera.pid)" 2>/dev/null || true
  log "All services stopped."
  exit 0
}
trap cleanup INT TERM

# Keep script alive
wait
