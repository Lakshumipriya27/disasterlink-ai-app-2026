@echo off
REM Starts the FastAPI backend on http://localhost:8000 (Swagger: http://localhost:8000/docs)
cd /d "%~dp0backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
pause
