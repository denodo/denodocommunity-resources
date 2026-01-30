@echo off
echo Starting batch orchestrator...

set BIN_DIR=C:\Users\DineshrajaAnnadurai\Documents\denodo_inst\Denodo Governance Bridge_v9_ga\denodo-governance-bridge-9-20240627\denodo-collibra-governance-bridge-20240627

echo Launching b1.bat in background...
start /b "" "%BIN_DIR%\bin\denodo-collibra-governance-bridge.bat" > bridge.log 2>&1

timeout /t 10 /nobreak >nul
echo Starting sync + TL flow...

pushd "%BIN_DIR%"

:: ---- Run b2 and capture HTTP response ----

set "HTTP_CODE_B2="
for /f "tokens=2" %%i in ('call bin\denodo-collibra-synchronize-governance-bridge.bat conf\input-sync.json 2^>nul ^| findstr /b "HTTP/1.1"') do set "HTTP_CODE_B2=%%i"

echo "%HTTP_CODE_B2%"

if "%HTTP_CODE_B2%"=="200" (
    echo sync complete.
) else (
    echo sync failed. killing 8442
    call "bin\shutdown_collibra.bat"
    popd
    goto :end
)

:: ---- Run b3 and capture HTTP response ----
set "HTTP_CODE_B3="
for /f "tokens=2" %%i in ('call bin\denodo-collibra-generate-technical-lineage-governance-bridge.bat conf\input-technical-lineage.json 2^>nul ^| findstr /b "HTTP/1.1"') do set "HTTP_CODE_B3=%%i"


if "%HTTP_CODE_B3%"=="200" (
    echo TechLineage completed.
) else (
    echo TechLineage failed.
    popd
    exit /b 1
)


call "bin\shutdown_collibra.bat"
popd
:end
echo complete
