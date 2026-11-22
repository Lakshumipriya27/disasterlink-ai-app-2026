@echo off
REM Starts the React development server on http://localhost:5173
cd /d "%~dp0frontend"
call npm run dev
pause
