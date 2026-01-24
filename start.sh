#!/bin/bash

# SaveMyData 홈 클라우드 실행 스크립트

echo "🚀 SaveMyData 홈 클라우드를 시작합니다..."

# 터미널 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 프로젝트 루트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd "$SCRIPT_DIR"

# 의존성 설치 확인
echo -e "${YELLOW}📦 의존성 확인 중...${NC}"

# 백엔드 의존성 확인
if [ ! -d "apps/backend/node_modules" ]; then
    echo -e "${BLUE}📥 백엔드 의존성 설치 중...${NC}"
    cd apps/backend
    npm install
    cd ../..
fi

# 프론트엔드 의존성 확인
if [ ! -d "apps/frontend/node_modules" ]; then
    echo -e "${BLUE}📥 프론트엔드 의존성 설치 중...${NC}"
    cd apps/frontend
    npm install
    cd ../..
fi

# 저장소 디렉토리 생성
if [ ! -d "storage" ]; then
    echo -e "${BLUE}📁 저장소 디렉토리 생성 중...${NC}"
    mkdir -p storage/metadata
    echo "저장소가 준비되었습니다: $(pwd)/storage"
fi

# .env 파일 확인
if [ ! -f "apps/backend/.env" ]; then
    echo -e "${YELLOW}⚙️  환경 설정 파일 생성 중...${NC}"
    cp apps/backend/.env.example apps/backend/.env
    echo "환경 설정 파일이 생성되었습니다. 필요시 apps/backend/.env 파일을 수정하세요."
fi

echo -e "${GREEN}✅ 모든 의존성이 준비되었습니다!${NC}"
echo

# 함수 정의: 프로세스 종료
cleanup() {
    echo -e "\n${YELLOW}🛑 서버를 종료합니다...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "백엔드 서버가 종료되었습니다."
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "프론트엔드 서버가 종료되었습니다."
    fi
    echo -e "${GREEN}👋 SaveMyData를 이용해 주셔서 감사합니다!${NC}"
    exit 0
}

# 시그널 핸들러 등록
trap cleanup SIGINT SIGTERM

# 백엔드 서버 시작
echo -e "${BLUE}🔧 백엔드 서버 시작 중... (포트 3001)${NC}"
cd apps/backend
npm run start:dev &
BACKEND_PID=$!
cd ../..

# 잠깐 대기 (백엔드 시작 시간)
sleep 3

# 프론트엔드 서버 시작  
echo -e "${BLUE}🎨 프론트엔드 서버 시작 중... (포트 3000)${NC}"
cd apps/frontend
npm run dev &
FRONTEND_PID=$!
cd ../..

# 서버 시작 완료 메시지
sleep 5
echo
echo -e "${GREEN}🎉 SaveMyData가 성공적으로 실행되었습니다!${NC}"
echo
echo -e "${GREEN}📱 웹 인터페이스:${NC} http://localhost:3000"
echo -e "${GREEN}🔧 API 서버:${NC} http://localhost:3001"
echo -e "${GREEN}📂 저장소 위치:${NC} $(pwd)/storage"
echo
echo -e "${YELLOW}💡 종료하려면 Ctrl+C를 누르세요${NC}"
echo

# 무한 대기 (사용자가 Ctrl+C로 종료할 때까지)
wait