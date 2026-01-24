# 멀티스테이지 빌드를 사용한 Node.js 백엔드
FROM node:18-alpine AS builder

WORKDIR /app

# 패키지 파일들 복사
COPY package*.json ./
COPY tsconfig*.json ./

# 의존성 설치
RUN npm ci --only=production && npm cache clean --force

# 소스 코드 복사
COPY src ./src

# TypeScript 빌드
RUN npm run build

# 프로덕션 이미지
FROM node:18-alpine AS production

WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 도구 설치
RUN apk add --no-cache \
    postgresql-client \
    curl \
    && rm -rf /var/cache/apk/*

# 패키지 파일들 복사
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production && npm cache clean --force

# 빌드된 파일들 복사
COPY --from=builder /app/dist ./dist

# 저장소 디렉터리 생성
RUN mkdir -p /app/storage

# 포트 노출
EXPOSE 3001

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# 애플리케이션 실행
CMD ["npm", "run", "start:prod"]