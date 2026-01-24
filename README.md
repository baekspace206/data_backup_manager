# 💾 SaveMyData - 개인용 홈 클라우드

사진과 비디오를 안전하게 백업하고 관리할 수 있는 개인용 홈 클라우드 서비스입니다.

## ✨ 주요 기능

- 📱 **드래그 앤 드롭 파일 업로드** - 직관적인 파일 업로드
- 🖼️ **이미지 미리보기** - 썸네일과 원본 이미지 뷰어
- 🎬 **비디오 재생** - 브라우저에서 바로 비디오 재생
- 📅 **날짜별 정리** - 업로드 날짜 기준 자동 분류
- 💿 **외장 디스크 지원** - 로컬 → 외장 HDD/NAS 저장소 전환
- 🔍 **파일 검색 및 필터링** - 타입, 날짜별 검색
- ⚡ **실시간 헬스체크** - 저장소 상태 모니터링

## 🚀 빠른 시작

### 1. 자동 실행 (권장)

**macOS/Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```cmd
start.bat
```

### 2. 수동 실행

```bash
# 1. 의존성 설치
npm run install:all

# 2. 서버 실행
npm start
```

### 3. 브라우저 접속

```
http://localhost:3000
```

## 📁 프로젝트 구조

```
SaveMyData/
├── apps/
│   ├── backend/          # NestJS 백엔드
│   │   ├── src/
│   │   │   ├── uploads/     # 파일 업로드 API
│   │   │   ├── storage/     # 저장소 추상화
│   │   │   └── main.ts      # 애플리케이션 진입점
│   │   └── package.json
│   └── frontend/         # React 프론트엔드
│       ├── src/
│       │   ├── components/  # React 컴포넌트
│       │   ├── services/    # API 서비스
│       │   └── types/       # TypeScript 타입
│       └── package.json
├── storage/              # 파일 저장소
│   ├── 2026/01/19/      # 날짜별 디렉토리
│   └── metadata/        # 메타데이터
├── start.sh             # Unix 실행 스크립트
├── start.bat            # Windows 배치 파일
└── README.md
```

## ⚙️ 환경 설정

### 저장소 경로 변경

`apps/backend/.env` 파일에서 저장소 위치를 변경할 수 있습니다:

```bash
# 외장 디스크 (macOS)
STORAGE_PATH=/Volumes/ExternalHDD/SaveMyData

# 외장 디스크 (Windows)  
STORAGE_PATH=E:\SaveMyData

# 네트워크 드라이브
STORAGE_PATH=\\NAS\BackupStorage
```

### 포트 변경

- **백엔드**: `apps/backend/.env`에서 `PORT=3001`
- **프론트엔드**: `apps/frontend/vite.config.ts`에서 `port: 3000`

## 💻 개발 환경

### 요구사항

- Node.js 18.0.0 이상
- NPM 9.0.0 이상
- 디스크 여유 공간 (저장소용)

### 개발 모드 실행

```bash
# 백엔드만 실행
npm run start:backend

# 프론트엔드만 실행  
npm run start:frontend

# 빌드
npm run build
```

## 🔧 API 엔드포인트

### 파일 관리
- `POST /api/uploads/files` - 파일 업로드
- `GET /api/uploads/files` - 파일 목록 조회
- `GET /api/uploads/files/:id` - 파일 다운로드
- `GET /api/uploads/thumbnails/:id` - 썸네일 조회
- `DELETE /api/uploads/files/:id` - 파일 삭제

### 저장소 관리
- `GET /api/storage/info` - 저장소 정보 조회
- `POST /api/storage/test-path` - 저장소 경로 테스트
- `POST /api/storage/migrate` - 저장소 마이그레이션
- `GET /api/storage/health` - 저장소 상태 확인

## 🛡️ 보안 고려사항

- 파일 타입 검증 (화이트리스트 방식)
- 파일 크기 제한 (500MB)
- SHA256 체크섬 검증
- 경로 순회(Path Traversal) 방지

## 📦 지원 파일 형식

### 이미지
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- HEIC (.heic)

### 비디오
- MP4 (.mp4)
- MOV (.mov)
- AVI (.avi)
- QuickTime (.mov)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙋‍♂️ 문제 해결

### 포트 충돌
```bash
# 사용 중인 포트 확인
lsof -i :3000
lsof -i :3001

# 프로세스 종료
kill -9 <PID>
```

### 권한 문제 (macOS/Linux)
```bash
# 실행 권한 부여
chmod +x start.sh

# 저장소 디렉토리 권한
chmod 755 storage/
```

### 외장 디스크 인식 안됨
1. 디스크가 올바르게 마운트되었는지 확인
2. `.env` 파일의 `STORAGE_PATH` 경로 확인  
3. 웹 인터페이스에서 저장소 상태 확인

---

💾 **SaveMyData v1.0** - 당신의 소중한 추억을 안전하게 보관하세요!