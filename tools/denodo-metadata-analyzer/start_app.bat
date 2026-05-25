@echo off
setlocal EnableExtensions

REM ===== Paths =====
set "ROOT=%~dp0"
pushd "%ROOT%"
set "PYTHON=python"
set "VENV_DIR=%ROOT%venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
set "ACTIVATE=%VENV_DIR%\Scripts\activate.bat"

REM Prefer py launcher if plain python isn't on PATH
where %PYTHON% >nul 2>&1
if errorlevel 1 set "PYTHON=py"

REM ===== Create venv if missing =====
if exist "%VENV_PY%" goto after_create

echo [INFO] Creating Python venv...
"%PYTHON%" -m venv "%VENV_DIR%"
if errorlevel 1 goto py_fail

set "JUST_CREATED=1"

:after_create
REM ===== Activate venv (safe even if already active) =====
call "%ACTIVATE%"

REM ===== First-run dependency install (only when venv just created) =====
if not defined JUST_CREATED goto check_build
if not exist "%ROOT%requirements.txt" goto check_build

echo [INFO] Installing Python requirements (first run)...
"%VENV_PY%" -m pip install --upgrade pip
if errorlevel 1 goto py_fail
"%VENV_PY%" -m pip install -r "%ROOT%requirements.txt"
if errorlevel 1 goto py_fail

:check_build
REM ===== Ensure committed Next.js build exists =====
if exist "%ROOT%metadata-analyzer\out\index.html" goto run_server

echo [ERROR] Next.js app not built. Missing:
echo         "%ROOT%metadata-analyzer\out\index.html"
echo.
echo The build files are missing. Please ensure you have the latest version
echo with pre-built static files, or build manually with:
echo   cd metadata-analyzer
echo   npm install
echo   npm run build
goto end

:run_server
echo.
echo [START] App running at http://localhost:41301
"%VENV_PY%" "%ROOT%python\view_complexity_server.py"
goto end

:py_fail
echo [ERROR] Python environment setup failed.
goto end

:end
popd
endlocal
