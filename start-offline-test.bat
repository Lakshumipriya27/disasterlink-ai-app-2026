@echo off
REM Builds the production PWA and serves it on http://localhost:4173 (needed to test offline mode).
cd /d "%~dp0frontend"
call npm run build || (pause & exit /b 1)
call npm run preview
pause
