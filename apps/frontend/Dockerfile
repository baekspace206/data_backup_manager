# 멀티스테이지 빌드를 사용한 React 프론트엔드
# 빌드 스테이지는 AMD64에서만 실행 (정적 파일은 아키텍처 무관)
FROM --platform=linux/amd64 node:20-alpine AS builder

WORKDIR /app

# 패키지 파일들 복사
COPY package*.json ./

# 의존성 설치
RUN npm install --no-audit

# 소스 코드 복사
COPY . .

# 프로덕션 빌드 (정적 HTML/CSS/JS 생성)
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