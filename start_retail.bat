@echo off
:: 1. Start the Backend Tunnel
start "Retail Backend" cmd /k "instatunnel 8001 --subdomain bbgoyal-backend"

:: 2. Start the Frontend Tunnel
start "Retail Frontend" cmd /k "instatunnel 3000 --subdomain bbgoyal-frontend"

:: 3. Start the Actual Backend Server
cd /d "D:\Retail Code\Retail\backend"
start "FastAPI Server" cmd /k "uvicorn server:app --host 0.0.0.0 --port 8001"

:: 4. Start the Actual Frontend
cd /d "D:\Retail Code\Retail\frontend"
start "React Frontend" cmd /k "yarn start"