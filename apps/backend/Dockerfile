# 멀티스테이지 빌드를 사용한 Node.js 백엔드
FROM node:20-alpine AS builder

# 빌드 아키텍처 정보
ARG TARGETARCH
ARG TARGETOS

WORKDIR /app

# 시스템 패키지 업데이트 및 빌드 도구 설치 (native dependencies용)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc6-compat \
    vips-dev \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    glib-dev \
    expat-dev \
    && rm -rf /var/cache/apk/*

# 환경 변수 설정
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=development
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_build_from_source=true

# Node 및 npm 버전 확인
RUN node --version && npm --version

# 패키지 파일들 복사
COPY package*.json ./
COPY tsconfig*.json ./

# package.json 내용 확인
RUN cat package.json

# npm 설정 확인
RUN npm config list

# 의존성 설치 (문제 있는 패키지 제외하고 먼저 설치)
RUN npm install --no-optional --ignore-scripts --verbose --no-audit

# Sharp 별도 설치 (네이티브 바이너리 사용)
RUN npm install sharp --platform=linux --arch=$TARGETARCH --verbose

# 나머지 스크립트 실행
RUN npm rebuild --verbose

# 캐시 정리
RUN npm cache clean --force

# 소스 코드 복사
COPY src ./src

# TypeScript 빌드
RUN npm run build

# 프로덕션 이미지
FROM node:20-alpine AS production

WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 도구 설치
RUN apk add --no-cache \
    postgresql-client \
    curl \
    && rm -rf /var/cache/apk/*

# 패키지 파일들 복사
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm install --only=production && npm cache clean --force

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