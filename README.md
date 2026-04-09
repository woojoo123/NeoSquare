# NeoSquare

NeoSquare는 메타버스 공간 안에서 사람들이 자유롭게 만나고, 대화하고, 스터디하고, 필요하면 멘토링까지 진행할 수 있는 가상 커뮤니티 프로젝트입니다. 이 프로젝트의 핵심은 "멘토링 전용 플랫폼"이 아니라, 가상 공간 안에서 사람과 사람의 연결 경험을 더 직관적으로 만드는 커뮤니티 인터페이스에 있습니다.

Phaser 기반 로비, JWT 인증, 멘토링 요청/예약, 세션 진입, WebSocket signaling, WebRTC 연결 준비, 세션 종료 후 피드백, 알림 흐름까지 하나의 서비스 흐름으로 묶는 것을 MVP 범위로 두고 있습니다.

## 주요 기능

### 1. 인증 및 로비 진입
- 회원가입, 로그인, 현재 사용자 조회
- JWT access token 기반 인증
- 로그인 후 로비 진입 및 사용자 상태 유지

### 2. 가상 로비와 공간 조회
- Phaser 기반 로비 화면
- 공간 목록 조회 및 기본 로비 진입 흐름
- `/ws` 연결 및 WebSocket 사용자 식별 보강

### 3. 멘토링 요청과 세션 진입
- 멘토링 요청 생성
- 보낸 요청 / 받은 요청 조회
- 요청 수락 / 거절
- 수락된 요청 기준 세션 페이지 진입

### 4. 예약
- 멘토링 예약 생성
- 내 예약 / 받은 예약 조회
- 예약 수락 / 거절 / 취소
- 예약 시간 기준 세션 진입 조건 계산

### 5. 세션, 피드백, 알림
- 요청 기반 세션 채팅 및 WebRTC signaling 구조
- 세션 종료 상태 저장
- 요청 기반 피드백 저장 및 내 기록 조회
- 요청 수락 / 예약 수락 알림 조회 및 읽음 처리

## 기술 스택

### Backend
- Java 17
- Spring Boot
- Spring Web
- Spring Security
- Spring Data JPA
- Validation
- WebSocket
- JWT
- Lombok
- H2
- MariaDB
- Redis (목표 스택, 현재 로컬 자동 설정 비활성화)

### Frontend
- React
- Vite
- React Router
- Zustand
- Axios
- Phaser

### Realtime / Media
- WebSocket
- WebRTC
- `getUserMedia`
- `RTCPeerConnection`

## 아키텍처 / 흐름 요약

1. 사용자는 회원가입 또는 로그인 후 JWT access token을 발급받습니다.
2. 프론트는 `/api/auth/me`, `/api/spaces`, 멘토링 요청/예약/피드백/알림 API를 호출해 로비 상태를 구성합니다.
3. 멘토링 요청이나 예약이 수락되면 세션 페이지로 진입할 수 있습니다.
4. 요청 기반 세션은 `/ws`와 signaling 흐름을 통해 WebRTC offer/answer/ICE candidate를 교환합니다.
5. 세션 종료 시 request 또는 reservation 상태를 서버에 반영하고, 이후 요청 기반 피드백 저장과 알림 조회 흐름으로 이어집니다.

현재 구조는 "REST로 상태를 저장하고, WebSocket은 연결/식별과 signaling 중심으로 얇게 유지"하는 방향에 가깝습니다.

## 실행 방법

### 사전 준비
- Java 17
- Node.js 18 이상 권장
- npm

현재 backend 기본 실행 설정은 로컬 H2 파일 DB를 사용합니다. Redis는 아직 자동 설정이 비활성화되어 있어 필수는 아닙니다.

### Spring Profile 구성
- `local`: 기본 프로필. 로컬 H2 파일 DB를 사용하고 로컬 시연용 더미 데이터를 자동으로 넣습니다.
- `mariadb`: MariaDB를 사용하고 로컬 시연용 더미 데이터를 자동으로 넣습니다.
- `prod`: 운영용 프로필. MariaDB를 사용하며 더미 데이터를 넣지 않습니다.
- `test`: 테스트 전용 프로필. H2 in-memory DB를 사용합니다.

프로필을 명시하지 않으면 `local`이 기본으로 적용됩니다.

### MariaDB 초기 준비 예시
MariaDB로 실행하려면 먼저 DB와 계정을 만들어 두는 편이 안전합니다.

```sql
CREATE DATABASE neosquare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'neosquare'@'localhost' IDENTIFIED BY 'neosquare1234!';
GRANT ALL PRIVILEGES ON neosquare.* TO 'neosquare'@'localhost';
FLUSH PRIVILEGES;
```

### 1. Backend 실행
프로젝트 루트에서:

```bash
./gradlew :backend:bootRun
```

기본 주소:
- API: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health`

기본 `local` 프로필은 별도 DB 준비 없이 바로 실행됩니다.

MariaDB로 실행하려면 아래처럼 `mariadb` 프로필과 환경변수를 함께 지정합니다.

```bash
export SPRING_PROFILES_ACTIVE=mariadb
export DB_URL=jdbc:mariadb://localhost:3306/neosquare
export DB_USERNAME=neosquare
export DB_PASSWORD=neosquare1234!
export JWT_SECRET=replace-with-32-bytes-or-more-secret

./gradlew :backend:bootRun
```

### 2. Frontend 실행
별도 터미널에서:

```bash
cd frontend
npm install
npm run dev
```

기본 주소:
- Frontend: `http://localhost:5173`

현재 `frontend/vite.config.js`에 `/api`, `/ws` 프록시가 설정되어 있어, 로컬 개발에서는 별도 프론트 환경변수 없이도 backend(`localhost:8080`)와 연결할 수 있습니다.

### 3. 검증 명령

Backend 테스트:

```bash
./gradlew :backend:test
```

테스트는 `test` 프로필과 H2 in-memory DB를 사용합니다.

Frontend 빌드:

```bash
cd frontend
npm run build
```

## 환경변수 또는 설정 정보

### Backend
현재 `backend/src/main/resources/application.yaml` 기준 최소 설정은 다음과 같습니다.

| 키 | 기본값 / 현재 상태 | 설명 |
| --- | --- | --- |
| `JWT_SECRET` | 기본 개발용 값 존재 | JWT 서명 키 |
| `JWT_ACCESS_TOKEN_EXPIRATION_MILLIS` | `3600000` | access token 만료 시간(ms) |
| `SPRING_PROFILES_ACTIVE` | `local` | 실행 프로필 |
| `DB_URL` | `jdbc:mariadb://localhost:3306/neosquare` | MariaDB 프로필 JDBC URL |
| `DB_USERNAME` | 없음 | MariaDB 계정 |
| `DB_PASSWORD` | 없음 | MariaDB 비밀번호 |
| `JPA_DDL_AUTO` | `update` | JPA 스키마 반영 전략 |

참고:
- 공통 설정은 `application.yaml`, 프로필별 설정은 `application-local.yaml`, `application-mariadb.yaml`, `application-prod.yaml`, `application-test.yaml`에 분리되어 있습니다.
- backend 기본 실행은 `local` 프로필과 H2 파일 DB를 기준으로 동작합니다.
- MariaDB 기반 실행은 `mariadb` 또는 `prod` 프로필에서 사용합니다.
- 테스트만 `test` 프로필과 H2 in-memory 설정을 사용합니다.
- Redis 자동 설정은 현재 비활성화되어 있어 로컬 실행 필수 조건이 아닙니다.

### 로컬 더미 데이터
`local` 프로필로 backend를 실행하면 로비와 멘토링 흐름을 바로 확인할 수 있게 더미 데이터가 자동으로 들어갑니다.

공통 비밀번호:
- `demo1234!`

더미 계정:
- `mina@neosquare.local` / `미나`
- `jisu@neosquare.local` / `지수`
- `hyunwoo@neosquare.local` / `현우`
- `seoyeon@neosquare.local` / `서연`

포함되는 더미 데이터:
- 보낸 요청 / 받은 요청 / 수락된 요청 / 종료된 요청 예시
- 수락된 예약 / 대기 중 예약 / 종료된 예약 예시
- 요청 기반 / 예약 기반 세션 피드백 예시
- 요청 수락 / 예약 수락 알림 예시

### Frontend

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | REST API base URL |
| `VITE_WS_URL` | `/ws` 또는 same-host ws URL | WebSocket base URL |
| `VITE_WEBRTC_ICE_SERVERS` | Google STUN 1개 기본값 사용 | WebRTC ICE server JSON 배열 |

프론트와 백엔드를 다른 호스트로 띄우는 경우 예시:

```bash
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
VITE_WEBRTC_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"}]'
```

## 디렉터리 구조 요약

```text
NeoSquare/
├─ backend/
│  ├─ src/main/java/com/neosquare/
│  │  ├─ auth/          # 인증, JWT, 로그인/회원가입
│  │  ├─ config/        # 보안, WebSocket 설정
│  │  ├─ mentoring/     # 멘토링 요청, 예약, 피드백 도메인
│  │  ├─ notification/  # 알림 도메인
│  │  ├─ realtime/      # WebSocket handler, signaling, 세션 식별
│  │  ├─ space/         # 공간 조회
│  │  ├─ user/          # 사용자 도메인
│  │  └─ common/        # 공통 응답/예외 처리
│  └─ src/test/java/com/neosquare/
│     ├─ auth/
│     ├─ mentoring/
│     ├─ notification/
│     ├─ realtime/
│     └─ space/
├─ frontend/
│  ├─ src/api/          # Axios API 래퍼
│  ├─ src/components/   # 공통 UI, Phaser wrapper
│  ├─ src/game/         # Phaser scene
│  ├─ src/lib/          # WebSocket, media, utility 훅/함수
│  ├─ src/pages/        # Login, Signup, Lobby, Session
│  ├─ src/router/       # 라우팅 및 인증 가드
│  └─ src/store/        # Zustand auth store
└─ docs/
   └─ PORTFOLIO.md      # 포트폴리오용 요약 문구
```

## 현재 구현 상태

### 구현 완료
- 회원가입 / 로그인 / 현재 사용자 조회
- 공간 목록 / 공간 상세 조회
- 멘토링 요청 생성, sent/received 조회, 수락/거절, 상세 조회
- 예약 생성, my/received 조회, 수락/거절/취소, 상세 조회
- 요청 기반 세션 종료 및 피드백 저장
- 요청 수락 / 예약 수락 알림 저장, 조회, 읽음 처리
- JWT 기반 REST 인증
- WebSocket handshake 단계 사용자 식별 및 senderId 신뢰 보강
- 프론트 fallback 대부분 제거 및 서버 API 기준 데이터 조회

### 부분 구현 / 운영형 보강 필요
- 로비 실시간 presence / 공개 채팅은 UI와 연결 구조는 있으나, 서버 동기화 계층은 최소 WebSocket 레이어 수준입니다.
- WebRTC는 최소 signaling 및 P2P 연결 구조까지 구현되어 있으며, TURN 서버, 네트워크 예외 대응, 운영형 품질 보강이 필요합니다.
- 예약 기반 세션은 세션 페이지를 재사용하지만, reservation 전용 signaling/chat/feedback API는 아직 확장 전입니다.
- 피드백은 현재 request 기반 저장을 우선 지원합니다. reservation 기반 피드백은 아직 서버 API가 없습니다.
- Redis 운영형 구성은 아직 활성화되어 있지 않습니다.

### 예정 기능
- reservation 기반 피드백 / 리뷰 저장
- 로비 실시간 사용자 동기화와 공개 채팅 서버 측 확장
- WebSocket 실시간 알림 push
- TURN 서버 도입 및 WebRTC 안정화
- 운영형 데이터베이스/캐시 설정 정리
- 배포 문서, 시연 시나리오, 발표 자료 정리

## 향후 개선 사항
- request / reservation 기반 세션을 더 명확한 세션 도메인으로 통합
- reservation feedback 및 히스토리 확장
- unread 카운트, dismiss 정책, 실시간 push를 포함한 알림 센터 고도화
- WebRTC 품질 보강 및 운영 환경 테스트
- Docker, 배포 환경변수, 시연 체크리스트 문서화

## 포트폴리오 요약 문구

포트폴리오에 옮겨 적기 쉬운 요약은 [docs/PORTFOLIO.md](docs/PORTFOLIO.md)에 정리했습니다.
