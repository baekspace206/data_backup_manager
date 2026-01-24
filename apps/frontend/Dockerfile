# 멀티스테이지 빌드를 사용한 React 프론트엔드
FROM node:20-alpine AS builder

WORKDIR /app

# 시스템 패키지 업데이트
RUN apk add --no-cache python3 make g++ libc6-compat && rm -rf /var/cache/apk/*

# 환경 변수 설정
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=development

# 패키지 파일들 복사
COPY package*.json ./

# npm 설정
RUN npm config set unsafe-perm true

# 의존성 설치
RUN npm install --verbose && npm cache clean --force

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