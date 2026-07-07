@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo    Midjourney 배치 자동 생성
echo ============================================
echo.
echo  이 폴더의 프롬프트 txt 파일 목록:
echo.
dir /b *.txt 2>nul | findstr /v "state.json cookies.txt requirements.txt"
echo.
set /p FILE="실행할 프롬프트 파일 이름을 입력하세요 (예: test.txt): "
echo.
if not exist "%FILE%" (
  echo [오류] "%FILE%" 파일을 이 폴더에서 찾을 수 없습니다.
  echo         파일 이름을 다시 확인하세요.
  echo.
  pause
  exit /b 1
)
python mj_batch.py --prompts "%FILE%" --cookies cookies.txt
echo.
echo ============================================
echo  끝났습니다. 이 창을 닫으려면 아무 키나 누르세요.
echo ============================================
pause >nul
