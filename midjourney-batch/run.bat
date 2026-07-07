@echo off
cd /d "%~dp0"
echo ============================================
echo    Midjourney Batch Runner
echo ============================================
echo.
echo  TXT files in this folder:
echo.
for %%F in (*.txt) do (
  if /I not "%%~nxF"=="cookies.txt" if /I not "%%~nxF"=="requirements.txt" (
    echo    %%~nxF
  )
)
echo.
set /p FILE="Type the prompt file name (e.g. test.txt): "
echo.
if not exist "%FILE%" (
  echo [ERROR] File "%FILE%" not found in this folder.
  echo         Please check the file name.
  echo.
  pause
  exit /b 1
)
if not exist "cookies.txt" (
  echo [ERROR] cookies.txt not found in this folder.
  echo         Export it from Chrome extension "Get cookies.txt LOCALLY"
  echo         and save as cookies.txt here.
  echo.
  pause
  exit /b 1
)
echo Running: python mj_batch.py --prompts "%FILE%" --cookies cookies.txt
echo.
python mj_batch.py --prompts "%FILE%" --cookies cookies.txt
echo.
echo ============================================
echo  Done. Press any key to close this window.
echo ============================================
pause >nul
