@echo off
setlocal

REM Set the port number
set PORT=8442

REM Find the PID using the specified port
for /f "tokens=5" %%i in ('netstat -aon ^| findstr :%PORT%') do (
    set PID=%%i
    REM Exit the loop after the first match
    goto :found
)

echo No process found using port %PORT%
exit /b 1

:found
REM Kill the process with the found PID
echo Killing process with PID %PID% using port %PORT%
taskkill /PID %PID% /F

endlocal
