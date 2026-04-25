# 배포 / 실행 가이드

이 문서는 NeoSquare의 현재 실행 기준 문서입니다. 로컬 개발은 `backend`와 `frontend`를 분리해 실행하고, EC2 배포는 프론트 정적 파일이 포함된 단일 `jar`를 `127.0.0.1:8080`에 띄운 뒤, 앞단의 Nginx가 `80/443`을 받아 리버스 프록시합니다.

## 1. 현재 실행 구조

- 로컬 개발: `backend`와 `frontend`를 따로 실행
- EC2 배포: `frontend/dist`를 포함한 `backend` 단일 `jar`를 `127.0.0.1:8080`에 실행
- 공개 진입점: Nginx (`80/443`) -> Spring Boot (`127.0.0.1:8080`)
- 기준 스크립트:
  - 앱 배포: `scripts/deploy-ec2-artifacts.sh`
  - DB 준비: `scripts/setup-ec2-mariadb.sh`
  - Nginx + HTTPS 준비: `scripts/setup-ec2-nginx.sh`

`backend/build.gradle`에서 `frontend/dist`를 `bootJar` 전에 `backend/build/resources/main/static`으로 복사하므로, 최종 `jar` 하나에 프론트 정적 파일과 백엔드가 함께 포함됩니다.

## 2. 사전 준비

### 로컬

- Java 17
- Node.js 18 이상 권장
- npm

### EC2

- Ubuntu 기준
- SSH 접속 가능
- Java 17 런타임 설치
- `mariadb` 또는 `prod` 프로필을 쓸 경우 MariaDB 준비

권장 인바운드 규칙:

- `22/tcp` for SSH
- `80/tcp` for HTTP + Let's Encrypt challenge
- `443/tcp` for HTTPS

운영 배포에서는 `8080/tcp`를 외부에 열지 않는 구성을 권장합니다.

## 3. 로컬 실행

### 가장 빠른 시연

- 프로필: `local`
- DB: H2 파일 DB
- 더미 데이터: 자동 주입

```bash
./gradlew :backend:bootRun

cd frontend
npm install
npm run dev
```

### MariaDB 기반 로컬 실행

- 프로필: `mariadb`
- DB: MariaDB
- 더미 데이터: 자동 주입

```bash
export SPRING_PROFILES_ACTIVE=mariadb
export DB_URL=jdbc:mariadb://localhost:3306/neosquare
export DB_USERNAME=neosquare
export DB_PASSWORD=neosquare1234!
export JWT_SECRET=replace-with-32-bytes-or-more-secret

./gradlew :backend:bootRun
```

### 운영형에 가까운 점검

- 프로필: `prod`
- DB: MariaDB
- 더미 데이터: 비활성화

```bash
export SPRING_PROFILES_ACTIVE=prod
export DB_URL=jdbc:mariadb://localhost:3306/neosquare
export DB_USERNAME=neosquare
export DB_PASSWORD=neosquare1234!
export JPA_DDL_AUTO=validate
export JWT_SECRET=replace-with-32-bytes-or-more-secret

./gradlew :backend:bootRun
```

## 4. MariaDB 준비

수동으로 준비하려면 아래를 사용합니다.

```sql
CREATE DATABASE neosquare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'neosquare'@'localhost' IDENTIFIED BY 'neosquare1234!';
GRANT ALL PRIVILEGES ON neosquare.* TO 'neosquare'@'localhost';
FLUSH PRIVILEGES;
```

권장 설정:

- 로컬 시연: `JPA_DDL_AUTO=update`
- 운영 점검: `JPA_DDL_AUTO=validate`

EC2에서 Java 17과 MariaDB를 한 번에 준비하려면 아래 스크립트를 사용할 수 있습니다.

```bash
./scripts/setup-ec2-mariadb.sh <EC2_PUBLIC_IP>
```

## 5. Frontend 환경변수

로컬 개발에서는 `frontend/vite.config.js` 프록시 덕분에 별도 설정 없이도 동작합니다. 프론트와 백엔드를 다른 호스트로 붙이거나 TURN 서버를 명시할 때만 설정하면 됩니다.

```bash
cd frontend
cp .env.example .env.local
cat <<'EOF' >> .env.local
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
EOF
```

TURN 서버 예시:

```bash
VITE_WEBRTC_STUN_URLS=stun:stun.l.google.com:19302
VITE_WEBRTC_TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
VITE_WEBRTC_TURN_USERNAME=turn-user
VITE_WEBRTC_TURN_CREDENTIAL=turn-password
```

주의:

- `VITE_WEBRTC_ICE_SERVERS` JSON 방식과 `STUN/TURN 분리 env` 방식을 둘 다 지원합니다.
- JSON 방식이 있으면 그 값이 우선입니다.
- 둘 다 없으면 기본 Google STUN을 사용합니다.

## 6. EC2 Nginx + 단일 jar 배포

### 1회 준비

Java 17만 먼저 설치하려면 EC2에서 아래를 실행합니다.

```bash
sudo apt update
sudo apt install -y openjdk-17-jre-headless
```

MariaDB까지 함께 준비할 경우에는 `scripts/setup-ec2-mariadb.sh`를 사용하는 편이 간단합니다.

도메인을 EC2 퍼블릭 IP에 연결한 뒤, Nginx와 Let's Encrypt를 한 번 준비합니다.

```bash
./scripts/setup-ec2-nginx.sh <EC2_PUBLIC_IP> <APP_DOMAIN> <LETSENCRYPT_EMAIL>
```

예시:

```bash
./scripts/setup-ec2-nginx.sh 43.000.000.00 app.example.com admin@example.com
```

이 스크립트는 아래를 처리합니다.

1. EC2에 `nginx`, `certbot`, `python3-certbot-nginx` 설치
2. `app.example.com -> 127.0.0.1:8080` 프록시 설정
3. Let's Encrypt 인증서 발급
4. HTTP 요청을 HTTPS로 리다이렉트

사전 조건:

- 도메인 A 레코드가 EC2 퍼블릭 IP를 가리켜야 함
- EC2 보안 그룹에서 `80`, `443`이 열려 있어야 함

### 배포 실행

기본값은 `mariadb` 프로필과 로컬 EC2 MariaDB(`localhost:3306`) 기준입니다. 필요하면 환경변수를 먼저 덮어쓴 뒤 배포합니다.

```bash
export SPRING_PROFILES_ACTIVE=mariadb
export DB_URL=jdbc:mariadb://localhost:3306/neosquare
export DB_USERNAME=neosquare
export DB_PASSWORD=neosquare1234!
export JPA_DDL_AUTO=update
export JWT_SECRET=replace-with-32-bytes-or-more-secret
export APP_DOMAIN=app.example.com

./scripts/deploy-ec2-artifacts.sh <EC2_PUBLIC_IP>
```

스크립트 동작 순서:

1. 로컬에서 `frontend`를 `npm run build`로 빌드
2. 로컬에서 `./gradlew :backend:bootJar` 실행
3. EC2의 `/home/ubuntu/neosquare-app` 디렉터리 준비
4. `backend.jar`와 `app.env` 업로드
5. EC2에서 기존 `backend.jar` 프로세스 종료
6. `SERVER_ADDRESS=127.0.0.1`로 `backend.jar` 실행
7. `http://127.0.0.1:8080/api/health` 응답 확인

배포 후 접속 주소:

- Application: `https://<APP_DOMAIN>`
- Health check on EC2: `http://127.0.0.1:8080/api/health`

### 로그 확인

```bash
ssh -i /Users/woojoo/AWS/neosquare-key.pem ubuntu@<EC2_PUBLIC_IP>
tail -f /home/ubuntu/neosquare-app/backend.log
```

### 알아둘 점

- 프론트 변경 사항도 최종 `jar` 안에 포함되므로, 프론트 수정 후에도 반드시 재배포해야 합니다.
- 스크립트는 `backend.jar` 프로세스를 재기동하지만 OS 서비스나 `systemd`를 사용하지는 않습니다.
- 배포 스크립트는 `JWT_REFRESH_TOKEN_COOKIE_SECURE=true`와 `SERVER_ADDRESS=127.0.0.1`를 기본으로 넣습니다.
- Nginx가 `X-Forwarded-*` 헤더를 넘기고, Spring Boot는 이를 신뢰하도록 설정되어 있습니다.

## 7. 접속 주소

- Backend API: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health`
- Frontend dev server: `http://localhost:5173`
- WebSocket: `ws://localhost:8080/ws`

운영 EC2에서는 외부 공개 주소를 아래처럼 봅니다.

- Application: `https://<APP_DOMAIN>`
- Nginx -> Backend proxy target: `http://127.0.0.1:8080`

## 8. 로컬 더미 계정

`local` 또는 `mariadb` 프로필에서 더미 데이터가 자동 주입되면 아래 계정으로 바로 시연할 수 있습니다.

- `mina@neosquare.local` / `demo1234!`
- `jisu@neosquare.local` / `demo1234!`
- `hyunwoo@neosquare.local` / `demo1234!`
- `seoyeon@neosquare.local` / `demo1234!`

## 9. 기본 smoke test

1. 계정 A, 계정 B로 각각 로그인
2. 로비 진입 확인
3. 멘토링 요청 생성 -> 수락 -> 세션 입장
4. 예약 생성 -> 수락 -> 예약 세션 입장
5. 세션 종료 -> 요청/예약 피드백 저장
6. 알림 패널 조회 및 읽음 처리
7. 스터디 라운지에서 스터디 세션 생성 -> 참가 -> 채팅
