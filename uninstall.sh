#!/usr/bin/env bash

# Komorebi Omoi - System Uninstaller
# Reverses all changes made by install.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}=================================================="
echo -e "     KOMOREBI OMOI - SYSTEM UNINSTALLER           "
echo -e "==================================================${NC}"
echo ""
echo -e "${YELLOW}⚠  This will remove Komorebi Omoi from your system."
echo -e "   Agents, workspaces, and config data will be preserved"
echo -e "   unless you explicitly choose to purge them below.${NC}"
echo ""

# Confirm intent
read -r -p "Are you sure you want to uninstall Komorebi Omoi? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo -e "${CYAN}Uninstall cancelled. No changes were made.${NC}"
  exit 0
fi

echo ""

# ─── Step 1: Stop and disable systemd service ─────────────────────────────────
echo -e "${BLUE}[1/5] Stopping Gateway daemon service...${NC}"

if systemctl is-active --quiet komorebi-gateway 2>/dev/null; then
  sudo systemctl stop komorebi-gateway
  echo -e "${GREEN}  ✓ Stopped komorebi-gateway service.${NC}"
else
  echo -e "${YELLOW}  ↷ Gateway service was not running.${NC}"
fi

if systemctl is-enabled --quiet komorebi-gateway 2>/dev/null; then
  sudo systemctl disable komorebi-gateway
  echo -e "${GREEN}  ✓ Disabled komorebi-gateway from autostart.${NC}"
fi

if [ -f "/etc/systemd/system/komorebi-gateway.service" ]; then
  sudo rm -f /etc/systemd/system/komorebi-gateway.service
  sudo systemctl daemon-reload
  echo -e "${GREEN}  ✓ Removed systemd unit file.${NC}"
fi

# macOS launchd
LAUNCHD_FILE="$HOME/Library/LaunchAgents/ai.komorebi.gateway.plist"
if [ -f "$LAUNCHD_FILE" ]; then
  launchctl unload "$LAUNCHD_FILE" 2>/dev/null || true
  rm -f "$LAUNCHD_FILE"
  echo -e "${GREEN}  ✓ Removed macOS launchd agent.${NC}"
fi

# Kill any remaining background PID
PID_FILE="$HOME/.komorebi/gateway.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  kill "$PID" 2>/dev/null && echo -e "${GREEN}  ✓ Killed background gateway process (PID: $PID).${NC}" || true
  rm -f "$PID_FILE"
fi

# ─── Step 2: Remove CLI symlink from system PATH ───────────────────────────────
echo -e "${BLUE}[2/5] Removing global CLI 'komorebi' from PATH...${NC}"

if [ -L /usr/local/bin/komorebi ]; then
  sudo rm -f /usr/local/bin/komorebi
  echo -e "${GREEN}  ✓ Removed /usr/local/bin/komorebi symlink.${NC}"
else
  echo -e "${YELLOW}  ↷ No CLI symlink found at /usr/local/bin/komorebi.${NC}"
fi

# npm unlink
CLI_DIR="$(cd "$(dirname "$0")/cli" && pwd)"
if [ -d "$CLI_DIR" ]; then
  cd "$CLI_DIR"
  npm unlink --global 2>/dev/null || true
  cd - > /dev/null
  echo -e "${GREEN}  ✓ Removed npm global link.${NC}"
fi

# ─── Step 3: Ask about data purge ─────────────────────────────────────────────
echo -e "${BLUE}[3/5] Agent Data & Configuration...${NC}"
echo ""
echo -e "${YELLOW}  The following directories contain your agent workspaces and config:${NC}"
echo -e "    • $HOME/.komorebi/         (runtime state, PID files, user config)"
echo -e "    • (project workspaces inside this repo)"
echo ""

read -r -p "  Purge ALL agent data and user config from ~/.komorebi? (yes/no): " PURGE_DATA
if [ "$PURGE_DATA" = "yes" ]; then
  rm -rf "$HOME/.komorebi"
  echo -e "${GREEN}  ✓ Purged ~/.komorebi directory.${NC}"
else
  echo -e "${CYAN}  ↷ Preserved ~/.komorebi — your config and agents data is safe.${NC}"
fi

# ─── Step 4: Ask about node_modules cleanup ────────────────────────────────────
echo -e "${BLUE}[4/5] Node Modules Cleanup...${NC}"
echo ""
read -r -p "  Remove all node_modules from this project? (yes/no): " PURGE_MODULES
if [ "$PURGE_MODULES" = "yes" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  for dir in "$SCRIPT_DIR" "$SCRIPT_DIR/gateway" "$SCRIPT_DIR/agent-runtime" "$SCRIPT_DIR/cli" "$SCRIPT_DIR/dashboard"; do
    if [ -d "$dir/node_modules" ]; then
      rm -rf "$dir/node_modules"
      echo -e "${GREEN}  ✓ Removed $dir/node_modules${NC}"
    fi
  done
else
  echo -e "${CYAN}  ↷ Preserved node_modules.${NC}"
fi

# ─── Step 5: Summary ──────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[5/5] Uninstall Summary${NC}"
echo -e "${GREEN}=================================================="
echo -e "  Komorebi Omoi has been uninstalled from your system."
echo -e "=================================================="
echo -e "${NC}"
echo -e "  ${CYAN}To reinstall at any time, run:${NC}  bash install.sh"
echo -e "  ${CYAN}To reconfigure only, run:${NC}       komorebi reconfigure"
echo ""
