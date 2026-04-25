#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <EC2_PUBLIC_IP> <APP_DOMAIN> <LETSENCRYPT_EMAIL>"
  exit 1
fi

EC2_PUBLIC_IP="$1"
APP_DOMAIN="$2"
LETSENCRYPT_EMAIL="$3"
KEY_PATH="${KEY_PATH:-/Users/woojoo/AWS/neosquare-key.pem}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE="${REMOTE_USER}@${EC2_PUBLIC_IP}"
SSH_OPTS=(-o ConnectTimeout=10 -o IdentitiesOnly=yes -i "$KEY_PATH")

ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "APP_DOMAIN='$APP_DOMAIN' LETSENCRYPT_EMAIL='$LETSENCRYPT_EMAIL' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y nginx certbot python3-certbot-nginx

sudo mkdir -p /var/www/certbot

NGINX_CONFIG_PATH="/etc/nginx/sites-available/neosquare.conf"

sudo tee "$NGINX_CONFIG_PATH" >/dev/null <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${APP_DOMAIN};

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location /ws {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600;
  }

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600;
  }
}
EOF

sudo ln -sfn "$NGINX_CONFIG_PATH" /etc/nginx/sites-enabled/neosquare.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

sudo certbot --nginx \
  --non-interactive \
  --agree-tos \
  --keep-until-expiring \
  --redirect \
  --email "$LETSENCRYPT_EMAIL" \
  -d "$APP_DOMAIN"

sudo nginx -t
sudo systemctl reload nginx

echo "Nginx HTTPS is ready: https://${APP_DOMAIN}"
REMOTE_SCRIPT
