# 배포 / 실행 가이드

NeoSquare는 현재 `backend`와 `frontend`를 분리해서 실행하는 구조입니다. 이 문서는 로컬 시연, MariaDB 기반 실행, 프론트 환경변수, 운영 전 체크 포인트를 빠르게 확인하기 위한 문서입니다.

## 1. 실행 모드 선택

### 가장 빠른 로컬 시연
- backend: `local` 프로필
- DB: H2 파일 DB
- 더미 데이터: 자동 주입
- 용도: 기능 확인, UI 시연, 2계정 테스트

```bash
./gradlew :backend:bootRun
cd frontend
npm install
npm run dev
```

### MariaDB 기반 로컬 실행
- backend: `mariadb` 프로필
- DB: MariaDB
- 더미 데이터: 자동 주입
- 용도: 브라우저 세션이 아니라 DB 기준으로 상태를 확인하는 시연

```bash
export SPRING_PROFILES_ACTIVE=mariadb
export DB_URL=jdbc:mariadb://localhost:3306/neosquare
export DB_USERNAME=neosquare
export DB_PASSWORD=neosquare1234!
export JWT_SECRET=replace-with-32-bytes-or-more-secret

./gradlew :backend:bootRun
```

### 운영형에 가까운 실행
- backend: `prod` 프로필
- DB: MariaDB
- 더미 데이터: 비활성화
- 용도: 실제 배포 전 smoke test

```bash
export SPRING_PROFILES_ACTIVE=prod
export DB_URL=jdbc:mariadb://localhost:3306/neosquare
export DB_USERNAME=neosquare
export DB_PASSWORD=neosquare1234!
export JPA_DDL_AUTO=validate
export JWT_SECRET=replace-with-32-bytes-or-more-secret

./gradlew :backend:bootRun
```

## 2. MariaDB 준비

```sql
CREATE DATABASE neosquare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'neosquare'@'localhost' IDENTIFIED BY 'neosquare1234!';
GRANT ALL PRIVILEGES ON neosquare.* TO 'neosquare'@'localhost';
FLUSH PRIVILEGES;
```

권장:
- 로컬 시연: `JPA_DDL_AUTO=update`
- 운영 점검: `JPA_DDL_AUTO=validate`

## 3. Frontend 환경변수

Vite 개발 서버를 프록시 없이 별도 호스트로 붙이거나, WebRTC ICE 서버를 명시적으로 넘기고 싶을 때 사용합니다.

```bash
cd frontend
cp .env.example .env.local
cat <<'EOF' >> .env.local
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
EOF
```

TURN 서버를 붙이는 경우 예시:

```bash
VITE_WEBRTC_STUN_URLS=stun:stun.l.google.com:19302
VITE_WEBRTC_TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
VITE_WEBRTC_TURN_USERNAME=turn-user
VITE_WEBRTC_TURN_CREDENTIAL=turn-password
```

주의:
- `VITE_WEBRTC_ICE_SERVERS` JSON 방식과 `STUN/TURN 분리 env` 방식 둘 다 지원합니다.
- JSON 방식이 있으면 그 값이 우선입니다.
- 둘 다 없으면 프론트는 기본 Google STUN으로 fallback 합니다.

## 3-1. TURN 실환경 점검

TURN 적용 후에는 아래를 같이 확인하는 편이 안전합니다.

1. 브라우저 두 개를 서로 다른 네트워크에서 접속
2. 멘토링 또는 예약 세션에 같이 입장
3. 세션 화면 상단 `ICE` 상태가 `TURN 설정됨`으로 보이는지 확인
4. 카메라/마이크 준비 후 실제로 상대 영상이 연결되는지 확인
5. 연결 실패 시:
   - TURN URL 오타
   - username / credential 불일치
   - 3478/5349 포트 방화벽
   - `turn:` / `turns:` 프로토콜 mismatch
   를 먼저 점검

## 4. 접속 주소

- Backend API: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health`
- Frontend dev server: `http://localhost:5173`
- WebSocket: `ws://localhost:8080/ws`

## 5. 로컬 더미 계정

`local` 또는 `mariadb` 프로필에서 더미 데이터가 자동 주입되면 아래 계정으로 바로 시연할 수 있습니다.

- `mina@neosquare.local` / `demo1234!`
- `jisu@neosquare.local` / `demo1234!`
- `hyunwoo@neosquare.local` / `demo1234!`
- `seoyeon@neosquare.local` / `demo1234!`

## 6. 실행 전 체크

### Backend
- `JWT_SECRET`가 32바이트 이상인지 확인
- MariaDB 모드라면 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` 확인
- `http://localhost:8080/api/health` 응답 확인

### Frontend
- `npm install` 완료
- `npm run dev` 또는 `npm run build` 성공 확인
- `VITE_API_BASE_URL`, `VITE_WS_URL`가 실제 backend 주소와 맞는지 확인
- WebRTC 시연 전 브라우저 카메라/마이크 권한 허용

## 7. 기본 smoke test

1. 계정 A, 계정 B로 각각 로그인
2. 로비 진입 확인
3. 멘토링 요청 생성 -> 수락 -> 세션 입장
4. 예약 생성 -> 수락 -> 예약 세션 입장
5. 세션 종료 -> 요청/예약 피드백 저장
6. 알림 패널 조회 및 읽음 처리
7. 스터디 라운지에서 스터디 세션 생성 -> 참가 -> 채팅

## 8. 현재 운영형으로 더 필요한 것

- TURN 서버 실제 배포 및 자격 증명 관리
- WebRTC 재접속 정책 고도화
- WebSocket 멀티 인스턴스 대응
- MariaDB 백업/마이그레이션 전략
- 정적 프론트 배포 경로와 backend CORS 분리
