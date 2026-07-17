#!/usr/bin/env bash

# Exit on any error
set -e

# Mask/Chalk-style colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================================="
echo -e "      KOMOREBI OMOI - UNIVERSAL SETUP WIZARD      "
echo -e "==================================================${NC}"

# 1. OS Detection
OS="$(uname -s)"
echo -e "${BLUE}[1/5] OS Detection:${NC} Running on ${OS} ($(uname -m))"

# 2. Node.js 22+ validation
NODE_OK=false
if command -v node &> /dev/null; then
  NODE_VER="$(node -v | cut -d. -f1)"
  NODE_VER="${NODE_VER//v/}"
  if [ "$NODE_VER" -ge 22 ]; then
    NODE_OK=true
  fi
fi

if [ "$NODE_OK" = false ]; then
  echo -e "${YELLOW}[INFO] Node.js 22+ is missing. Installing NVM...${NC}"
  
  # Fetch NVM
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  
  # Load NVM
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  
  echo -e "${BLUE}[Installer] Installing Node.js 22...${NC}"
  nvm install 22
  nvm use 22
  nvm alias default 22
else
  echo -e "${GREEN}[PASS] Compatible Node.js detected: $(node -v)${NC}"
fi

# 3. Installing dependencies & building
echo -e "${BLUE}[2/5] Compiling and building TypeScript packages...${NC}"
npm install --no-bin-links

cd gateway
npm install --no-bin-links
node node_modules/typescript/bin/tsc
cd ..

cd agent-runtime
npm install --no-bin-links
node node_modules/typescript/bin/tsc
cd ..

cd cli
npm install --no-bin-links
node ../gateway/node_modules/typescript/bin/tsc
cd ..

# 4. Global CLI Linking
echo -e "${BLUE}[3/5] Binding global CLI link 'komorebi'...${NC}"
cd cli
npm link --no-bin-links || true
cd ..
sudo ln -sf "$(pwd)/cli/dist/index.js" /usr/local/bin/komorebi
echo -e "${GREEN}[PASS] CLI globally linked to system PATH (/usr/local/bin/komorebi).${NC}"

# 5. systemd / launchd configuration
echo -e "${BLUE}[4/5] Background Service Daemon Configurations...${NC}"
if [ "$OS" = "Linux" ]; then
  echo -e "Would you like to install the systemd daemon to run the gateway automatically 24/7? (y/n)"
  read -r install_daemon
  if [ "$install_daemon" = "y" ] || [ "$install_daemon" = "Y" ]; then
    echo -e "${BLUE}[Daemon] Writing systemd service configurations...${NC}"
    sudo cp config/komorebi-gateway.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable komorebi-gateway
    echo -e "${GREEN}[Daemon] systemd service 'komorebi-gateway' registered. Starts automatically on system boot.${NC}"
  fi
elif [ "$OS" = "Darwin" ]; then
  echo -e "Would you like to register a launchd daemon to run the gateway automatically on login? (y/n)"
  read -r install_daemon
  if [ "$install_daemon" = "y" ] || [ "$install_daemon" = "Y" ]; then
    LAUNCHD_FILE="$HOME/Library/LaunchAgents/ai.komorebi.gateway.plist"
    cat <<EOF > "$LAUNCHD_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.komorebi.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$(pwd)/gateway/dist/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
    launchctl load "$LAUNCHD_FILE"
    echo -e "${GREEN}[Daemon] launchd agent registered: ${LAUNCHD_FILE}${NC}"
  fi
fi

# 6. Bootstrapping onboarding Wizard TUI immediately
echo -e "${BLUE}[5/5] Launching interactive onboarding wizard TUI...${NC}"
node cli/dist/index.js onboard
