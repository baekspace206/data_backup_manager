@echo off
chcp 65001 >nul
title SaveMyData 홈 클라우드

echo 🚀 SaveMyData 홈 클라우드를 시작합니다...
echo.

:: 프로젝트 루트로 이동
cd /d "%~dp0"

:: 의존성 설치 확인
echo 📦 의존성 확인 중...

:: 백엔드 의존성 확인
if not exist "apps\backend\node_modules" (
    echo 📥 백엔드 의존성 설치 중...
    cd apps\backend
    call npm install
    cd ..\..
)

:: 프론트엔드 의존성 확인
if not exist "apps\frontend\node_modules" (
    echo 📥 프론트엔드 의존성 설치 중...
    cd apps\frontend
    call npm install
    cd ..\..
)

:: 저장소 디렉토리 생성
if not exist "storage" (
    echo 📁 저장소 디렉토리 생성 중...
    mkdir storage
    mkdir storage\metadata
    echo 저장소가 준비되었습니다: %CD%\storage
)

:: .env 파일 확인
if not exist "apps\backend\.env" (
    echo ⚙️ 환경 설정 파일 생성 중...
    copy "apps\backend\.env.example" "apps\backend\.env" >nul
    echo 환경 설정 파일이 생성되었습니다. 필요시 apps\backend\.env 파일을 수정하세요.
)

echo ✅ 모든 의존성이 준비되었습니다!
echo.

:: 백엔드 서버 시작
echo 🔧 백엔드 서버 시작 중... (포트 3001)
cd apps\backend
start "SaveMyData Backend" cmd /k "npm run start:dev"
cd ..\..

:: 잠깐 대기
timeout /t 3 /nobreak >nul

:: 프론트엔드 서버 시작
echo 🎨 프론트엔드 서버 시작 중... (포트 3000)
cd apps\frontend
start "SaveMyData Frontend" cmd /k "npm run dev"
cd ..\..

:: 완료 메시지
timeout /t 5 /nobreak >nul
echo.
echo 🎉 SaveMyData가 성공적으로 실행되었습니다!
echo.
echo 📱 웹 인터페이스: http://localhost:3000
echo 🔧 API 서버: http://localhost:3001  
echo 📂 저장소 위치: %CD%\storage
echo.
echo 💡 각각의 터미널 창을 닫으면 해당 서버가 종료됩니다.
echo 💡 브라우저에서 http://localhost:3000 을 열어주세요!
echo.

:: 브라우저 자동 열기
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo 엔터키를 누르면 이 창이 닫힙니다...
pause >nul