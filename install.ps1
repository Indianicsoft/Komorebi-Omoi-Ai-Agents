Write-Host "==================================================" -ForegroundColor Blue
Write-Host "      KOMOREBI OMOI - WINDOWS SETUP WIZARD       " -ForegroundColor Blue
Write-Host "==================================================" -ForegroundColor Blue

# 1. Check Node.js Version
$NodeVersion = $null
if (Get-Command node -ErrorAction SilentlyContinue) {
    $NodeVersion = (node -v).Trim().TrimStart('v')
}

$MajorNode = 0
if ($NodeVersion) {
    $MajorNode = [int]($NodeVersion.Split('.')[0])
}

if ($MajorNode -lt 22) {
    Write-Host "[FAIL] Node.js 22+ is missing. Please install Node.js v22+ from https://nodejs.org/" -ForegroundColor Red
    Exit 1
} else {
    Write-Host "[PASS] Compatible Node.js Version detected: v$NodeVersion" -ForegroundColor Green
}

# 2. Build TypeScript Packages
Write-Host "[2/4] Installing dependencies and building TS projects..." -ForegroundColor Blue
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

# 3. Register Global Link
Write-Host "[3/4] Registering global command link 'komorebi'..." -ForegroundColor Blue
cd cli
npm link --no-bin-links
cd ..

# 4. Boot Onboarding Wizard
Write-Host "[4/4] Launching interactive onboarding wizard TUI..." -ForegroundColor Blue
node cli/dist/index.js onboard
