#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <EC2_PUBLIC_IP>"
  exit 1
fi

EC2_PUBLIC_IP="$1"
KEY_PATH="${KEY_PATH:-/Users/woojoo/AWS/neosquare-key.pem}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/NeoSquare}"
REMOTE="${REMOTE_USER}@${EC2_PUBLIC_IP}"
SSH_OPTS=(-o ConnectTimeout=10 -o IdentitiesOnly=yes -i "$KEY_PATH")

echo "Building backend jar locally..."
./gradlew :backend:bootJar

echo "Building frontend dist locally..."
(cd frontend && npm run build)

echo "Preparing remote project directory..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "
  set -e
  if [ ! -d '$REMOTE_DIR/.git' ]; then
    rm -rf '$REMOTE_DIR'
    git clone https://github.com/woojoo123/NeoSquare.git '$REMOTE_DIR'
  fi
  cd '$REMOTE_DIR'
  git pull --ff-only
  mkdir -p deploy
  rm -rf deploy/frontend-dist
"

echo "Uploading local artifacts..."
scp "${SSH_OPTS[@]}" backend/build/libs/backend-0.0.1-SNAPSHOT.jar "$REMOTE:$REMOTE_DIR/deploy/backend.jar"
scp "${SSH_OPTS[@]}" -r frontend/dist "$REMOTE:$REMOTE_DIR/deploy/frontend-dist"

echo "Starting containers without remote builds..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "
  set -e
  cd '$REMOTE_DIR'
  docker compose down --remove-orphans || true
  docker compose up -d
  docker compose ps
  for i in \$(seq 1 60); do
    if curl -fsS http://localhost:5173/api/health; then
      exit 0
    fi
    echo \"Waiting for backend to become ready... \$i/60\"
    sleep 2
  done
  echo 'Backend did not become ready. Recent backend logs:'
  docker compose logs --tail=120 backend
  exit 1
"

echo "Deployment complete: http://$EC2_PUBLIC_IP:5173"
