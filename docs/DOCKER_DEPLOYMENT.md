# Docker EC2 배포 가이드

이 방식은 EC2에서 직접 `npm install`, `npm run build`, `./gradlew bootRun`을 실행하지 않습니다.
EC2에는 Docker만 설치하고, 컨테이너 빌드/실행은 Compose가 처리합니다.

## 1. EC2 보안 그룹

시연용 최소 인바운드 규칙:

```text
SSH              TCP 22    0.0.0.0/0
사용자 지정 TCP   TCP 5173  0.0.0.0/0
```

Docker 구성에서는 프론트 Nginx가 EC2의 `5173` 포트로 열리고, `/api`, `/ws` 요청은 내부 backend 컨테이너로 프록시됩니다.
따라서 외부에서 `8080`을 열 필요는 없습니다.

## 2. EC2 Docker 설치

Ubuntu EC2 접속 후:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

권한 적용을 위해 SSH를 끊고 다시 접속합니다.

## 3. 프로젝트 실행

```bash
git clone https://github.com/woojoo123/NeoSquare.git
cd NeoSquare
docker compose up -d --build
```

이미 clone한 폴더가 있으면:

```bash
cd NeoSquare
git pull
docker compose up -d --build
```

## 4. 확인

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

브라우저 접속:

```text
http://EC2_PUBLIC_IP:5173
```

백엔드 health 확인:

```bash
curl http://localhost:5173/api/health
```

## 5. 중지 / 재시작

```bash
docker compose down
docker compose up -d
```

데이터까지 삭제하려면 아래를 사용합니다. H2 로컬 DB 볼륨도 삭제되므로 주의하세요.

```bash
docker compose down -v
```

