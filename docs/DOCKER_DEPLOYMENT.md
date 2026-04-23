# Docker EC2 배포 가이드

이 방식은 EC2에서 직접 `npm install`, `npm run build`, `./gradlew bootRun`, `docker compose build`를 실행하지 않습니다.
로컬 Mac에서 백엔드 jar와 프론트 dist를 만든 뒤 EC2로 업로드하고, EC2는 Docker로 실행만 합니다.

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

## 3. 로컬에서 산출물 빌드

로컬 Mac에서:

```bash
cd /Users/woojoo/javaTest/b01/NeoSquare
./gradlew :backend:bootJar

cd frontend
npm run build
```

## 4. EC2로 산출물 업로드

`EC2_PUBLIC_IP`를 실제 퍼블릭 IP로 바꿉니다.

```bash
ssh -i /Users/woojoo/AWS/neosquare-key.pem ubuntu@EC2_PUBLIC_IP "mkdir -p ~/NeoSquare/deploy"
scp -i /Users/woojoo/AWS/neosquare-key.pem backend/build/libs/backend-0.0.1-SNAPSHOT.jar ubuntu@EC2_PUBLIC_IP:/home/ubuntu/NeoSquare/deploy/backend.jar
scp -i /Users/woojoo/AWS/neosquare-key.pem -r frontend/dist ubuntu@EC2_PUBLIC_IP:/home/ubuntu/NeoSquare/deploy/frontend-dist
```

## 5. 프로젝트 실행

```bash
git clone https://github.com/woojoo123/NeoSquare.git
cd NeoSquare
docker compose up -d
```

이미 clone한 폴더가 있으면:

```bash
cd NeoSquare
git pull
docker compose up -d
```

## 6. 확인

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

## 7. 중지 / 재시작

```bash
docker compose down
docker compose up -d
```

데이터까지 삭제하려면 아래를 사용합니다. H2 로컬 DB 볼륨도 삭제되므로 주의하세요.

```bash
docker compose down -v
```
