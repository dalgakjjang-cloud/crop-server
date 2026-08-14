@echo off
chcp 65001 >nul
title 어도비 업스케일 도구
echo.
echo ============================================
echo   어도비 스톡용 이미지 업스케일
echo ============================================
echo.
echo 1) Pillow(이미지 라이브러리) 확인 중...
python -m pip install --quiet --disable-pip-version-check pillow
if errorlevel 1 (
  echo.
  echo [문제] 파이썬이 설치되어 있지 않은 것 같아요.
  echo   https://www.python.org/downloads/ 에서 파이썬을 먼저 설치하세요.
  echo   설치할 때 "Add Python to PATH" 체크를 꼭 켜세요.
  echo.
  pause
  exit /b
)
echo    준비 완료.
echo.
echo 2) 이 폴더의 이미지를 업스케일합니다...
echo.
python "%~dp0upscale_adobe.py" "%~dp0"
echo.
echo ============================================
echo   끝났습니다. 같은 폴더의 upscaled 폴더를 확인하세요.
echo ============================================
pause
