@echo off
REM One-time setup: creates the Python virtual environment and installs all dependencies.
cd /d "%~dp0backend"
echo [1/3] Creating Python virtual environment...
python -m venv .venv || goto :error
echo [2/3] Installing backend packages...
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt || goto :error
cd /d "%~dp0frontend"
echo [3/3] Installing frontend packages (this can take a few minutes)...
call npm install || goto :error
echo.
echo Setup complete. Now run start-backend.bat and start-frontend.bat
pause
exit /b 0
:error
echo Setup failed. See the message above.
pause
exit /b 1
