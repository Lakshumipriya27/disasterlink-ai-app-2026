@echo off
REM Deletes the local database and reloads the SIMULATED Chennai flood scenario.
cd /d "%~dp0backend"
.venv\Scripts\python.exe -m app.seed
pause
