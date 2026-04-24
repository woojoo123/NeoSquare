#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <EC2_PUBLIC_IP>"
  exit 1
fi

EC2_PUBLIC_IP="$1"
KEY_PATH="${KEY_PATH:-/Users/woojoo/AWS/neosquare-key.pem}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE="${REMOTE_USER}@${EC2_PUBLIC_IP}"
SSH_OPTS=(-o ConnectTimeout=10 -o IdentitiesOnly=yes -i "$KEY_PATH")
DB_NAME="${DB_NAME:-neosquare}"
DB_USERNAME="${DB_USERNAME:-neosquare}"
DB_PASSWORD="${DB_PASSWORD:-neosquare1234!}"

SQL_PASSWORD="${DB_PASSWORD//\'/\'\'}"

ssh "${SSH_OPTS[@]}" "$REMOTE" "DB_NAME='$DB_NAME' DB_USERNAME='$DB_USERNAME' DB_PASSWORD='$SQL_PASSWORD' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y openjdk-17-jre-headless mariadb-server
sudo systemctl enable --now mariadb

sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USERNAME}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USERNAME}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USERNAME}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "MariaDB is ready: ${DB_NAME} / ${DB_USERNAME}"
REMOTE_SCRIPT

