@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "BACKEND_PORT=8001"
set "FRONTEND_PORT=3000"
set "PYTHON=%ROOT%backend\venv\Scripts\python.exe"

:: Check if backend venv exists, fallback to system python
if not exist "%PYTHON%" (
    echo [WARN] Virtual environment not found at %PYTHON%
    set "PYTHON=py"
)

:: ---- Ensure JWT_SECRET_KEY in .env ----
set "ENV_FILE=%ROOT%backend\.env"
if not exist "%ENV_FILE%" (
    powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Set-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
    echo [INFO] Created backend\.env with new JWT_SECRET_KEY.
) else (
    findstr /i "JWT_SECRET_KEY" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Add-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
        echo [INFO] Added JWT_SECRET_KEY to .env.
    )
)

:: ---- Ensure Firewall rules ----
netsh advfirewall firewall show rule name="Retail App Port %BACKEND_PORT%" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="Retail App Port %BACKEND_PORT%" dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1
    if not errorlevel 1 echo [INFO] Firewall rule added for port %BACKEND_PORT%.
)
netsh advfirewall firewall show rule name="Retail App Port %FRONTEND_PORT%" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="Retail App Port %FRONTEND_PORT%" dir=in action=allow protocol=TCP localport=%FRONTEND_PORT% >nul 2>&1
    if not errorlevel 1 echo [INFO] Firewall rule added for port %FRONTEND_PORT%.
)

:: ---- Detect local IP ----
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "IP=%%a"
    set "IP=!IP: =!"
    goto :found_ip
)
:found_ip
if "!IP!"=="" set "IP=127.0.0.1"

:start_backend
echo [INFO] Checking for existing process on port %BACKEND_PORT%...
powershell -Command "$p = (Get-NetTCPConnection -LocalPort %BACKEND_PORT% -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1 }"
echo [INFO] Regenerating SSL certificate for current IP...
"%PYTHON%" "%ROOT%backend\gen_cert.py"
echo [INFO] Starting FastAPI backend on https://!IP!:%BACKEND_PORT% ...
(
    echo @echo off
    echo cd /d "%ROOT%backend"
    echo "%PYTHON%" -m uvicorn server:app --host 0.0.0.0 --port %BACKEND_PORT% --reload --ssl-keyfile ssl.key --ssl-certfile ssl.crt
) > "%TEMP%\retail_backend.bat"
start "FastAPI Server" cmd /k "%TEMP%\retail_backend.bat"

echo [INFO] Waiting for backend to start...
timeout /t 5 /nobreak >nul
echo [INFO] Backend ready!

:start_frontend
echo [INFO] Checking for existing process on port %FRONTEND_PORT%...
powershell -Command "$p = (Get-NetTCPConnection -LocalPort %FRONTEND_PORT% -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1 }"
echo [INFO] Starting React frontend...
"%PYTHON%" "%ROOT%backend\write_launcher.py" "%TEMP%\retail_frontend.bat" "%ROOT%frontend"
start "React Frontend" cmd /k "%TEMP%\retail_frontend.bat"

echo [INFO] Waiting for frontend to start...
timeout /t 8 /nobreak >nul
echo [INFO] Opening browser...
start "" "https://!IP!:%BACKEND_PORT%/api/"
timeout /t 2 /nobreak >nul
start "" "https://!IP!:%FRONTEND_PORT%/"
echo.
echo ==========================================
echo  Retail App Started!
echo  Backend:  https://!IP!:%BACKEND_PORT%/
echo  Frontend: https://!IP!:%FRONTEND_PORT%/
echo  NOTE: Accept BOTH certificate warnings in browser
echo ==========================================
echo.
echo  Press any key to close this window...
pause >nul
endlocal