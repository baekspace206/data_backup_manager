# 멀티스테이지 빌드를 사용한 Node.js 백엔드
FROM node:20-alpine AS builder

WORKDIR /app

# PostgreSQL 클라이언트와 최소한의 빌드 도구만 설치
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-dev \
    && rm -rf /var/cache/apk/*

# 환경 변수 설정
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=development
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# 패키지 파일들 복사
COPY package*.json ./
COPY tsconfig*.json ./

# 의존성 설치
RUN npm install --no-optional

# 소스 코드 복사
COPY src ./src

# TypeScript 빌드
RUN npm run build

# devDependencies 제거하여 프로덕션 node_modules 생성
RUN npm prune --production

# 프로덕션 이미지
FROM node:20-alpine AS production

WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 도구 설치
RUN apk add --no-cache \
    postgresql-client \
    curl \
    && rm -rf /var/cache/apk/*

# 빌드 스테이지에서 프로덕션 node_modules 복사 (npm install 재실행 방지)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 저장소 디렉터리 생성
RUN mkdir -p /app/storage

# 포트 노출
EXPOSE 3001

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# 애플리케이션 실행
CMD ["node", "dist/main.js"]