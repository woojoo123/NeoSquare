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
SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-mariadb}"
DB_URL="${DB_URL:-jdbc:mariadb://localhost:3306/neosquare}"
DB_USERNAME="${DB_USERNAME:-neosquare}"
DB_PASSWORD="${DB_PASSWORD:-neosquare1234!}"
JPA_DDL_AUTO="${JPA_DDL_AUTO:-update}"
JWT_SECRET="${JWT_SECRET:-neosquare-ec2-mariadb-secret-key-needs-at-least-32-bytes}"
APP_DOMAIN="${APP_DOMAIN:-}"

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

ENV_FILE="$(mktemp)"
cat > "$ENV_FILE" <<EOF
SPRING_PROFILES_ACTIVE=$SPRING_PROFILES_ACTIVE
DB_URL=$DB_URL
DB_USERNAME=$DB_USERNAME
DB_PASSWORD=$DB_PASSWORD
JPA_DDL_AUTO=$JPA_DDL_AUTO
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_TOKEN_COOKIE_SECURE=true
SERVER_ADDRESS=127.0.0.1
EOF

echo "Uploading runtime environment..."
scp "${SSH_OPTS[@]}" "$ENV_FILE" "$REMOTE:$REMOTE_DIR/app.env"
rm -f "$ENV_FILE"

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
  set -a
  . '$REMOTE_DIR/app.env'
  set +a
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

if [ -n "$APP_DOMAIN" ]; then
  echo "Deployment complete: https://$APP_DOMAIN"
else
  echo "Deployment complete. Backend is bound to 127.0.0.1:8080, so expose it through Nginx."
fi
