@echo off
:: ---- Self-elevate to Administrator if not already ----
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "BACKEND_PORT=8001"
set "ENV_FILE=%ROOT%backend\.env"
set "PYTHON=%ROOT%backend\venv\Scripts\python.exe"

if not exist "%PYTHON%" set "PYTHON=py"

echo ==========================================
echo  Retail App - Production Build ^& Run
echo ==========================================
echo.

:: ---- Step 0: Ensure JWT_SECRET_KEY exists in .env ----
if not exist "%ENV_FILE%" (
    echo [0/4] Creating backend\.env with a new JWT_SECRET_KEY...
    powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Set-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
    echo [0/4] .env created.
) else (
    findstr /i "JWT_SECRET_KEY" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [0/4] Adding JWT_SECRET_KEY to existing .env...
        powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Add-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
    ) else (
        echo [0/4] JWT_SECRET_KEY already set in .env. OK.
    )
)
echo.

:: ---- Detect local IP ----
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "IP=%%a"
    set "IP=!IP: =!"
    goto :found_ip
)
:found_ip
if "!IP!"=="" set "IP=127.0.0.1"

:: ---- Step 1: Windows Firewall rule ----
echo [1/4] Configuring Windows Firewall for port %BACKEND_PORT%...
netsh advfirewall firewall show rule name="Retail App Port %BACKEND_PORT%" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="Retail App Port %BACKEND_PORT%" dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Could not add firewall rule - run as Administrator for internet access.
    ) else (
        echo [1/4] Firewall rule added - port %BACKEND_PORT% now open.
    )
) else (
    echo [1/4] Firewall rule already exists. OK.
)
echo.

:: ---- Step 2: Build React Frontend ----
echo [2/4] Building React frontend for production...
cd /d "%ROOT%frontend"
set GENERATE_SOURCEMAP=false
call yarn build
if errorlevel 1 (
    echo [ERROR] React build failed! Check npm errors above.
    pause
    exit /b 1
)
echo [2/4] Build complete!
echo Copying build to backend...
if exist "%ROOT%backend\frontend" rmdir /s /q "%ROOT%backend\frontend"
xcopy /e /i /q "%ROOT%frontend\build" "%ROOT%backend\frontend\build" >nul
echo [2/4] Build copied to backend\frontend\build
echo.

:: ---- Step 3: Kill any existing backend process on port ----
echo [3/4] Checking for existing process on port %BACKEND_PORT%...
powershell -Command "$p = (Get-NetTCPConnection -LocalPort %BACKEND_PORT% -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1 }"

:: ---- Step 4: Regenerate SSL cert + Start backend ----
echo [4/4] Regenerating SSL certificate for current IP...
"%PYTHON%" "%ROOT%backend\gen_cert.py"
echo [4/4] Starting FastAPI production server on 0.0.0.0:%BACKEND_PORT%...
echo.
echo ==========================================
echo  ACCESS URLs:
echo  This PC:      https://!IP!:%BACKEND_PORT%/
echo  Network PC:   https://!IP!:%BACKEND_PORT%/
echo  Internet:     https://YOUR_STATIC_PUBLIC_IP:%BACKEND_PORT%/
echo  NOTE: Accept the security warning in browser (self-signed cert)
echo ==========================================
echo.
echo  API endpoints: /api/...
echo  Logs:          %ROOT%backend\server.log
echo  Health check:  https://!IP!:%BACKEND_PORT%/health
echo  Press Ctrl+C to stop.
echo.

cd /d "%ROOT%backend"
start "" "https://!IP!:%BACKEND_PORT%/"
"%PYTHON%" -m uvicorn server:app --host 0.0.0.0 --port %BACKEND_PORT% --ssl-keyfile ssl.key --ssl-certfile ssl.crt --log-level info

endlocal
pause