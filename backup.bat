@echo off
chcp 65001 >nul
title Retail Book - Database Backup

:: Change to script directory
cd /d "%~dp0"

:: Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

:: Check if backup.py exists
if not exist "backup_database.py" (
    echo [ERROR] backup_database.py not found
    pause
    exit /b 1
)

:: Check if virtual environment exists, if not use system Python
if exist "backend\venv\Scripts\python.exe" (
    set PYTHON=backend\venv\Scripts\python.exe
) else (
    set PYTHON=python
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              RETAIL BOOK - DATABASE BACKUP                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Show menu
echo [1] Create Backup Now (Interactive)
echo [2] Create Backup Now (Auto - No Prompts)
echo [3] List All Backups
echo [4] Restore from Backup
echo [5] Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Creating backup...
    %PYTHON% backup_database.py
    echo.
    pause
    exit /b 0
)

if "%choice%"=="2" (
    echo.
    echo Creating backup in auto mode...
    %PYTHON% backup_database.py --auto
    echo.
    pause
    exit /b 0
)

if "%choice%"=="3" (
    echo.
    %PYTHON% backup_database.py --list
    echo.
    pause
    exit /b 0
)

if "%choice%"=="4" (
    echo.
    echo Available backups:
    %PYTHON% backup_database.py --list
    echo.
    set /p backup_file="Enter backup filename to restore: "
    if "!backup_file!"=="" (
        echo No file specified. Exiting.
        pause
        exit /b 1
    )
    echo.
    echo WARNING: This will OVERWRITE existing data!
    set /p confirm="Type 'yes' to confirm restore: "
    if /I not "!confirm!"=="yes" (
        echo Restore cancelled.
        pause
        exit /b 0
    )
    %PYTHON% backup_database.py --restore "!backup_file!" --drop
    echo.
    pause
    exit /b 0
)

if "%choice%"=="5" (
    exit /b 0
)

echo.
echo [ERROR] Invalid choice
pause
exit /b 1
