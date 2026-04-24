# NeoSquare

NeoSquare는 Phaser 기반 가상 로비와 Spring Boot 백엔드를 결합한 메타버스형 커뮤니티 프로젝트입니다. 사용자는 공간 안에서 만나고 대화하고, 필요하면 멘토링 요청, 예약, 세션 입장, 피드백까지 하나의 흐름으로 이어갈 수 있습니다.

## 문서

- [문서 인덱스](docs/README.md)
- [배포 / 실행 가이드](docs/DEPLOYMENT.md)
- [시연 체크리스트](docs/DEMO_CHECKLIST.md)
- [2계정 QA 체크리스트](docs/QA_CHECKLIST.md)
- [메타버스 에셋 파이프라인](docs/metaverse-asset-pipeline.md)

## 핵심 기능

- JWT 기반 회원가입, 로그인, 현재 사용자 조회
- Phaser 로비, 공간 이동, 사용자 상호작용
- 멘토링 요청 생성, 수락/거절, 세션 입장
- 멘토링 예약 생성, 수락/거절/취소, 시간 기반 입장
- WebSocket signaling 및 WebRTC 세션 준비
- 요청 종료 후 피드백 저장, 알림 조회 및 읽음 처리
- 스터디 세션 생성, 참가, 채팅

## 기술 스택

### Backend

- Java 17
- Spring Boot
- Spring Security
- Spring Data JPA
- WebSocket
- JWT
- H2
- MariaDB

### Frontend

- React
- Vite
- Phaser
- Zustand
- Axios

### Realtime / Media

- WebSocket
- WebRTC
- `getUserMedia`
- `RTCPeerConnection`

## 빠른 실행

### 로컬 시연

```bash
./gradlew :backend:bootRun

cd frontend
npm install
npm run dev
```

- Backend API: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health`
- Frontend dev server: `http://localhost:5173`

기본 프로필은 `local`이며 H2 파일 DB와 더미 데이터가 자동으로 적용됩니다.

### MariaDB 기반 실행

```bash
export SPRING_PROFILES_ACTIVE=mariadb
export DB_URL=jdbc:mariadb://localhost:3306/neosquare
export DB_USERNAME=neosquare
export DB_PASSWORD=neosquare1234!
export JWT_SECRET=replace-with-32-bytes-or-more-secret

./gradlew :backend:bootRun
```

MariaDB 초기 준비와 추가 실행 옵션은 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)에 정리되어 있습니다.

## EC2 배포

현재 기준 배포 방식은 `단일 jar 업로드 -> EC2에서 java -jar 실행`입니다.

```bash
./scripts/deploy-ec2-artifacts.sh <EC2_PUBLIC_IP>
```

이 스크립트는 아래를 자동으로 수행합니다.

1. 로컬에서 `frontend`를 빌드합니다.
2. 프론트 정적 파일을 포함한 `backend` 단일 `jar`를 생성합니다.
3. EC2에 `backend.jar`와 `app.env`를 업로드합니다.
4. EC2에서 기존 프로세스를 정리하고 `nohup java -jar`로 재기동합니다.
5. `http://localhost:8080/api/health`로 헬스체크를 확인합니다.

EC2에서 MariaDB까지 함께 준비하려면 아래 스크립트를 먼저 한 번 실행하면 됩니다.

```bash
./scripts/setup-ec2-mariadb.sh <EC2_PUBLIC_IP>
```

상세 배포 절차와 환경변수 설명은 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)를 기준으로 보면 됩니다.

## 로컬 더미 계정

- `mina@neosquare.local` / `demo1234!`
- `jisu@neosquare.local` / `demo1234!`
- `hyunwoo@neosquare.local` / `demo1234!`
- `seoyeon@neosquare.local` / `demo1234!`

## 디렉터리 구조

```text
NeoSquare/
├─ backend/
│  └─ src/main/java/com/neosquare/
├─ frontend/
│  └─ src/
├─ docs/
└─ scripts/
```
