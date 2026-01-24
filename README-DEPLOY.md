# SaveMyData 라즈베리파이 배포 가이드

## 개요
이 가이드는 SaveMyData 애플리케이션을 라즈베리파이에서 Docker로 배포하는 방법을 설명합니다.

## 시스템 요구사항

### 라즈베리파이
- Raspberry Pi 4 Model B (권장: 4GB RAM 이상)
- Raspberry Pi OS Lite 64-bit
- 최소 16GB microSD 카드 (권장: 32GB 이상)
- 인터넷 연결

### 소프트웨어
- Docker 20.10 이상
- Docker Compose 2.0 이상
- Git

## 1. 라즈베리파이 초기 설정

### OS 설치 및 기본 설정
```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치
sudo apt install -y curl git vim htop

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# 재부팅 또는 재로그인
sudo reboot
```

### Docker Compose 설치
```bash
# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 설치 확인
docker --version
docker-compose --version
```

## 2. 애플리케이션 배포

### 저장소 클론
```bash
# 홈 디렉터리에 클론
cd ~
git clone https://github.com/baekspace206/data_backup_manager.git
cd data_backup_manager
```

### 환경 설정
```bash
# 프로덕션 환경 설정 파일 복사
cp apps/backend/.env.example apps/backend/.env

# 환경 변수 수정 (필요시)
nano apps/backend/.env
```

### Docker 이미지 pull 및 실행
```bash
# GitHub Container Registry에서 이미지 pull
docker pull ghcr.io/baekspace206/savemydata-backend:latest
docker pull ghcr.io/baekspace206/savemydata-frontend:latest

# 또는 로컬 빌드 (선택사항)
# docker-compose -f docker-compose.prod.yml build

# 애플리케이션 시작
docker-compose -f docker-compose.prod.yml up -d
```

### 서비스 상태 확인
```bash
# 컨테이너 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f

# 개별 서비스 로그 확인
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f postgres
```

## 3. Nginx 리버스 프록시 설정 (선택사항)

외부 도메인으로 접근하려는 경우 추가 Nginx 설정:

### Nginx 설치
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Nginx 설정 파일 생성
```bash
sudo nano /etc/nginx/sites-available/savemydata
```

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 실제 도메인으로 변경

    # Docker 컨테이너로 프록시
    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;

        # 파일 업로드 크기 제한 증가
        client_max_body_size 500M;
    }
}
```

### Nginx 활성화
```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/savemydata /etc/nginx/sites-enabled/

# 기본 사이트 비활성화
sudo rm /etc/nginx/sites-enabled/default

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

### SSL 인증서 설정 (선택사항)
```bash
# Let's Encrypt SSL 인증서 발급
sudo certbot --nginx -d your-domain.com
```

## 4. 시스템 서비스 등록

### systemd 서비스 파일 생성
```bash
sudo nano /etc/systemd/system/savemydata.service
```

```ini
[Unit]
Description=SaveMyData Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/pi/data_backup_manager
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

### 서비스 활성화
```bash
# 서비스 등록 및 활성화
sudo systemctl daemon-reload
sudo systemctl enable savemydata.service
sudo systemctl start savemydata.service

# 서비스 상태 확인
sudo systemctl status savemydata.service
```

## 5. 모니터링 및 관리

### 시스템 리소스 모니터링
```bash
# 시스템 리소스 확인
htop

# Docker 상태 확인
docker stats

# 디스크 사용량 확인
df -h

# 로그 로테이션 설정
sudo nano /etc/logrotate.d/docker
```

### 백업 설정
```bash
# 데이터베이스 백업 스크립트
nano ~/backup-database.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/pi/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# PostgreSQL 백업
docker exec savemydata_postgres pg_dump -U postgres savemydata > "$BACKUP_DIR/savemydata_$DATE.sql"

# 파일 스토리지 백업
tar -czf "$BACKUP_DIR/storage_$DATE.tar.gz" -C /var/lib/docker/volumes/data_backup_manager_storage_data/_data .

# 7일 이상 된 백업 파일 삭제
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# 백업 스크립트 실행 권한 부여
chmod +x ~/backup-database.sh

# cron 설정으로 자동 백업
crontab -e

# 매일 새벽 2시에 백업 실행
0 2 * * * /home/pi/backup-database.sh >> /home/pi/backup.log 2>&1
```

## 6. 업데이트 방법

### 애플리케이션 업데이트
```bash
# 저장소 업데이트
cd ~/data_backup_manager
git pull origin main

# 새 이미지 pull
docker pull ghcr.io/baekspace206/savemydata-backend:latest
docker pull ghcr.io/baekspace206/savemydata-frontend:latest

# 서비스 재시작
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# 불필요한 이미지 정리
docker image prune -f
```

## 7. 트러블슈팅

### 일반적인 문제 해결

1. **메모리 부족**
   ```bash
   # 스왑 파일 생성 (2GB)
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. **Docker 공간 부족**
   ```bash
   # Docker 정리
   docker system prune -af --volumes
   ```

3. **네트워크 연결 문제**
   ```bash
   # 포트 확인
   sudo netstat -tlnp | grep :80
   sudo netstat -tlnp | grep :3001

   # 방화벽 설정 (필요시)
   sudo ufw allow 80
   sudo ufw allow 443
   ```

4. **로그 확인**
   ```bash
   # 상세 로그 확인
   docker-compose -f docker-compose.prod.yml logs --tail=100 -f
   ```

## 8. 보안 설정

### 기본 보안 강화
```bash
# SSH 키 기반 인증 설정
# 방화벽 설정
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# 자동 업데이트 설정
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

## 9. 접속 정보

- **웹 인터페이스**: http://라즈베리파이_IP_주소
- **API 엔드포인트**: http://라즈베리파이_IP_주소/api
- **데이터베이스**: PostgreSQL (내부 네트워크만 접근 가능)

## 지원 및 문의

문제가 발생하면 다음을 확인해주세요:
1. GitHub Issues: https://github.com/baekspace206/data_backup_manager/issues
2. 로그 파일 확인
3. 시스템 리소스 상태 점검