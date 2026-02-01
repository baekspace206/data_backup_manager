# SaveMyData - Raspberry Pi 배포 가이드

## 1. 사전 준비

```bash
# Docker 설치 (미설치 시)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose 설치
sudo apt install docker-compose -y

# 재로그인 후 진행
```

## 2. 배포 디렉토리 생성

```bash
mkdir -p ~/savemydata
cd ~/savemydata
```

## 3. docker-compose.yml 생성

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: savemydata
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: ghcr.io/baekspace206/savemydata-backend:main
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: postgres
      DB_PASSWORD: postgres
      DB_DATABASE: savemydata
      STORAGE_PATH: /app/storage
    volumes:
      - "/media/baekjm/TOURO Mobile USB3.0/savemydata:/app/storage"
    ports:
      - "3001:3001"

  frontend:
    image: ghcr.io/baekspace206/savemydata-frontend:main
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"

volumes:
  postgres_data:
EOF
```

## 4. 이미지 Pull 및 실행

```bash
# GitHub Container Registry 로그인 (Private repo인 경우)
# echo "GITHUB_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin

# 이미지 Pull
docker-compose pull

# 컨테이너 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

## 5. 접속 확인

- **웹 UI**: `http://라즈베리파이IP`
- **백엔드 API**: `http://라즈베리파이IP:3001`

## 6. 유용한 명령어

```bash
# 상태 확인
docker-compose ps

# 재시작
docker-compose restart

# 중지
docker-compose down

# 업데이트 (새 이미지 Pull 후 재시작)
docker-compose pull && docker-compose up -d

# 로그 확인
docker-compose logs -f backend
```

## 7. 데이터 백업

```bash
# PostgreSQL 백업
docker-compose exec postgres pg_dump -U postgres savemydata > backup.sql

# 스토리지 백업
sudo cp -r /var/lib/docker/volumes/savemydata_storage_data/_data ./storage_backup
```
