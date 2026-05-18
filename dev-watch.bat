@echo off
:: Dev Watch Mode - For testing and bug fixes
:: NO admin required, NO build step, auto-reload on file changes
:: Uses react-scripts directly (avoids craco issues)
:: Original build_and_run.bat remains for production

setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "BACKEND_PORT=8001"
set "FRONTEND_PORT=3020"
set "ENV_FILE=%ROOT%backend\.env"
set "PYTHON=%ROOT%backend\venv\Scripts\python.exe"

if not exist "%PYTHON%" (
    echo [WARN] Virtual environment not found at %ROOT%backend\venv
    echo        Falling back to system Python.
    set "PYTHON=py"
)

echo ==========================================
echo  Retail App - DEV WATCH MODE
echo ==========================================
echo.
echo  Features:
echo  - Frontend: Auto-rebuild on save (port %FRONTEND_PORT%)
echo  - Backend:  Auto-restart on save (port %BACKEND_PORT%)
echo  - Uses react-scripts directly (no craco issues)
echo  - NO build step needed - just save files!
echo.
echo ==========================================

:: ---- Ensure JWT_SECRET_KEY exists ----
if not exist "%ENV_FILE%" (
    echo [SETUP] Creating backend\.env with JWT_SECRET_KEY...
    powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Set-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
    echo [SETUP] .env created.
) else (
    findstr /i "JWT_SECRET_KEY" "%ENV_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo [SETUP] Adding JWT_SECRET_KEY to existing .env...
        powershell -Command "$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); $key = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''; Add-Content -Path '%ENV_FILE%' -Value \"JWT_SECRET_KEY=$key\""
    )
)

:: ---- Kill ALL node processes and processes on ports ----
echo.
echo [CLEANUP] Stopping all Node processes and clearing ports...
powershell -Command "try { Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force } catch {}"
powershell -Command "try { Get-Process nodejs -ErrorAction SilentlyContinue | Stop-Process -Force } catch {}"
powershell -Command "Get-NetTCPConnection -LocalPort %FRONTEND_PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -Command "Get-NetTCPConnection -LocalPort %BACKEND_PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 3 /nobreak >nul 2>&1

echo.
echo ==========================================
echo  Starting Development Servers...
echo ==========================================
echo.

:: ---- Start Backend in new window ----
echo [1/2] Starting Backend (FastAPI + auto-reload)...
echo     URL: http://localhost:%BACKEND_PORT%/
echo     API: http://localhost:%BACKEND_PORT%/api/
echo     Docs: http://localhost:%BACKEND_PORT%/docs
echo.
start "Backend Dev Server" cmd /k "cd /d "%ROOT%backend" && echo [Backend] Starting with auto-reload... && "%PYTHON%" -m uvicorn server:app --reload --host 127.0.0.1 --port %BACKEND_PORT% --log-level info"

:: ---- Wait a moment for backend to start ----
timeout /t 3 /nobreak >nul 2>&1

:: ---- Start Frontend in new window ----
echo [2/2] Starting Frontend (React Dev Server)...
echo     URL: http://localhost:%FRONTEND_PORT%/
echo     Note: Uses react-scripts directly (bypasses craco issues)
echo     Note: Source map warnings for html5-qrcode are normal
echo.
start "Frontend Dev Server" cmd /k "cd /d "%ROOT%frontend" && set "PORT=%FRONTEND_PORT%" && set "BROWSER=none" && echo [Frontend] Starting dev server on port %FRONTEND_PORT%... && yarn start"

echo.
echo ==========================================
echo  BOTH SERVERS STARTING...
echo ==========================================
echo.
echo  Backend:  http://localhost:%BACKEND_PORT%/
echo  Frontend: http://localhost:%FRONTEND_PORT%/
echo.
echo  Features:
echo  - Edit any frontend file ^& save = instant browser update
echo  - Edit any backend .py file ^& save = auto-restart server
echo  - Press Ctrl+C in either window to stop that server
echo  - Close both windows to stop completely
echo.
echo  ^>^>^> Opening browser in 8 seconds... ^<^<^
echo.

:: ---- Open browser after delay ----
timeout /t 8 /nobreak >nul 2>&1
start "" "http://localhost:%FRONTEND_PORT%/"

echo ==========================================
echo  DEV MODE ACTIVE - Happy coding!
echo ==========================================

endlocal
