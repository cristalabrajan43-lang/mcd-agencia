# SSL Certificates

Place your SSL certificates in this directory:

- `fullchain.pem` — Full certificate chain (certificate + intermediate CAs)
- `privkey.pem` — Private key

## Option 1: Let's Encrypt (Recommended - Free)

```bash
# Install certbot on the server
sudo apt install certbot

# 1. First, start only nginx with HTTP (comment out SSL in nginx.conf temporarily)
# 2. Obtain certificate:
sudo certbot certonly --webroot -w ./nginx/certbot -d agenciamcd.mx -d www.agenciamcd.mx

# 3. Copy or symlink the certs:
sudo cp /etc/letsencrypt/live/agenciamcd.mx/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/agenciamcd.mx/privkey.pem ./nginx/ssl/

# 4. Set up auto-renewal cron:
# 0 0 1 * * certbot renew --deploy-hook "docker compose -f docker-compose.prod.yml restart nginx"
```

## Option 2: Purchased SSL Certificate

Copy the files from your certificate provider:
```bash
cp your_domain.crt ./nginx/ssl/fullchain.pem
cp your_domain.key ./nginx/ssl/privkey.pem
```

## ⚠️ IMPORTANT

- **NEVER** commit certificate files to version control
- Both `.pem` files are already in `.gitignore`
- Set proper permissions: `chmod 600 privkey.pem`
