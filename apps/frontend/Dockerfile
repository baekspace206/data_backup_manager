# 멀티스테이지 빌드를 사용한 React 프론트엔드
FROM node:20-alpine AS builder

WORKDIR /app

# 시스템 패키지 업데이트
RUN apk add --no-cache python3 make g++ libc6-compat && rm -rf /var/cache/apk/*

# 환경 변수 설정
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=development
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Node 및 npm 버전 확인
RUN node --version && npm --version

# 패키지 파일들 복사
COPY package*.json ./

# package.json 내용 확인
RUN cat package.json

# npm 설정 확인
RUN npm config list

# 의존성 설치 (Alpine 환경에 최적화)
RUN npm ci --verbose --no-audit || npm install --verbose --no-audit || (echo "Install failed, checking logs..." && find /root/.npm/_logs -name "*.log" -exec cat {} \; && exit 1)

# 캐시 정리
RUN npm cache clean --force

# 소스 코드 복사
COPY . .

# 프로덕션 빌드
RUN npm run build

# Nginx를 사용한 프로덕션 이미지
FROM nginx:alpine AS production

# curl 설치 (헬스체크용)
RUN apk add --no-cache curl && rm -rf /var/cache/apk/*

# Nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 빌드된 파일들 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 포트 노출
EXPOSE 80

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]