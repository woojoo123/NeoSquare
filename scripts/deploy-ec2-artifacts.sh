#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <EC2_PUBLIC_IP>"
  exit 1
fi

EC2_PUBLIC_IP="$1"
KEY_PATH="${KEY_PATH:-/Users/woojoo/AWS/neosquare-key.pem}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/neosquare-app}"
REMOTE="${REMOTE_USER}@${EC2_PUBLIC_IP}"
SSH_OPTS=(-o ConnectTimeout=10 -o IdentitiesOnly=yes -i "$KEY_PATH")

echo "Building frontend dist locally..."
(cd frontend && npm run build)

echo "Building backend jar locally with frontend assets..."
./gradlew :backend:bootJar

echo "Preparing remote runtime directory..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "
  set -e
  mkdir -p '$REMOTE_DIR'
"

echo "Uploading backend jar..."
scp "${SSH_OPTS[@]}" backend/build/libs/backend-0.0.1-SNAPSHOT.jar "$REMOTE:$REMOTE_DIR/backend.jar"

echo "Starting backend jar on EC2..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "
  set -e
  cd '$REMOTE_DIR'
  if command -v docker >/dev/null 2>&1; then
    docker ps -aq --filter name=neosquare | xargs -r docker rm -f
  fi
  pkill -f '[b]ackend.jar' || true
  if ! command -v java >/dev/null 2>&1; then
    echo 'Java is not installed on EC2. Install it once with: sudo apt update && sudo apt install -y openjdk-17-jre-headless'
    exit 1
  fi
  nohup java -jar '$REMOTE_DIR/backend.jar' > '$REMOTE_DIR/backend.log' 2>&1 &
  for i in \$(seq 1 60); do
    if curl -fsS http://localhost:8080/api/health; then
      exit 0
    fi
    echo \"Waiting for backend to become ready... \$i/60\"
    sleep 2
  done
  echo 'Backend did not become ready. Recent backend logs:'
  tail -120 '$REMOTE_DIR/backend.log'
  exit 1
"

echo "Deployment complete: http://$EC2_PUBLIC_IP:8080"
