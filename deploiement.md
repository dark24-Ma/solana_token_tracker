# Guide de déploiement - Solana Token Tracker

Ce document explique comment déployer l'application Solana Token Tracker sur un VPS avec l'adresse IP 185.97.146.99.

## Ports utilisés
- Backend (API): Port 6607
- Frontend: Port 6608

## Prérequis

- Un VPS avec Ubuntu 20.04 ou plus récent
- Accès SSH au VPS avec les droits sudo
- Un nom de domaine (optionnel)
- Git installé sur votre machine locale

## Méthode 1: Utilisation du script automatisé

Nous avons préparé un script qui automatise l'installation et la configuration du serveur.

1. Transférez le script `install_vps.sh` sur votre VPS:
   ```bash
   scp install_vps.sh utilisateur@185.97.146.99:/home/utilisateur/
   ```

2. Connectez-vous à votre VPS:
   ```bash
   ssh utilisateur@185.97.146.99
   ```

3. Rendez le script exécutable:
   ```bash
   chmod +x install_vps.sh
   ```

4. Exécutez le script:
   ```bash
   sudo ./install_vps.sh
   ```

5. Suivez les instructions à l'écran pour configurer votre installation.

## Méthode 2: Installation manuelle

Si vous préférez installer manuellement, suivez ces étapes:

### 1. Préparation du serveur

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer les dépendances
sudo apt install -y curl wget git build-essential htop nginx ufw

# Configurer le pare-feu
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw allow 6607 # Backend
sudo ufw allow 6608 # Frontend
sudo ufw enable
```

### 2. Installation de Node.js

```bash
# Installer Node.js 16.x
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier l'installation
node -v
npm -v

# Installer PM2
sudo npm install -g pm2
```

### 3. Installation de MongoDB (optionnel)

Si vous n'utilisez pas une base de données MongoDB externe:

```bash
# Ajouter les clés et le dépôt MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt update
sudo apt install -y mongodb-org

# Démarrer et activer MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 4. Déploiement du Backend

```bash
# Créer le répertoire d'installation
sudo mkdir -p /var/www/solana-token-tracker
sudo chown $USER:$USER /var/www/solana-token-tracker

# Cloner le dépôt
cd /var/www/solana-token-tracker
git clone https://github.com/votre-utilisateur/solana-token-tracker.git .

# Installer les dépendances backend
cd backend
npm install

# Configurer les variables d'environnement
cp .env.example .env
nano .env  # Modifier les variables selon vos besoins
```

Contenu typique du fichier `.env`:
```
MONGODB_URI=mongodb://localhost:27017/solana-token-tracker
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PORT=6607
ALLOWED_ORIGINS=http://185.97.146.99:6608,http://localhost:6608
```

### 5. Configuration PM2 pour le Backend

Vérifiez que le fichier `ecosystem.config.js` contient la configuration correcte pour le port 6607:

```javascript
module.exports = {
  apps: [
    {
      name: 'solana-token-tracker-api',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 6607
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 6607
      },
      time: true
    }
  ]
}; 
```

Ensuite, démarrez le backend:

```bash
# Démarrer l'application avec PM2
cd /var/www/solana-token-tracker/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Déploiement du Frontend

```bash
# Aller dans le répertoire frontend
cd /var/www/solana-token-tracker/frontend

# Installer les dépendances
npm install

# Mettre à jour le fichier API pour utiliser la bonne adresse
nano src/services/api.js  # Modifier les URLs pour pointer vers 185.97.146.99:6607

# Construire le frontend
npm run build

# Installer serve pour servir le frontend
npm install -g serve

# Créer un fichier de configuration PM2 pour le frontend
cat > frontend-ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'solana-token-tracker-frontend',
      script: 'serve',
      args: '-s dist -l 6608',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PM2_SERVE_PATH: 'dist',
        PM2_SERVE_PORT: 6608,
        PM2_SERVE_SPA: 'true'
      }
    }
  ]
};
EOF

# Démarrer le frontend avec PM2
pm2 start frontend-ecosystem.config.js
pm2 save
```

### 7. Configuration Nginx (optionnel)

Si vous souhaitez utiliser Nginx comme proxy reverse:

```bash
sudo nano /etc/nginx/sites-available/solana-token-tracker
```

Contenu du fichier:
```
# Configuration pour le backend (API)
server {
    listen 80;
    server_name api.185.97.146.99;

    location / {
        proxy_pass http://localhost:6607;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Configuration pour le frontend
server {
    listen 80;
    server_name 185.97.146.99;

    location / {
        proxy_pass http://localhost:6608;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Activer la configuration:
```bash
sudo ln -s /etc/nginx/sites-available/solana-token-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Accès à l'application

Une fois déployée, l'application sera accessible aux adresses suivantes:

- Backend API: http://185.97.146.99:6607
- Frontend: http://185.97.146.99:6608

## Maintenance

### Mettre à jour l'application

```bash
cd /var/www/solana-token-tracker
git pull
cd backend
npm install
pm2 restart all
```

### Vérifier les logs

```bash
# Logs du backend
pm2 logs solana-token-tracker-api

# Logs du frontend
pm2 logs solana-token-tracker-frontend
```

### Redémarrer les serveurs

```bash
pm2 restart all
```

## Dépannage

### Problèmes de connexion à MongoDB
Vérifiez que MongoDB est en cours d'exécution:
```bash
sudo systemctl status mongod
```

### L'API n'est pas accessible
Vérifiez que le serveur backend est en cours d'exécution sur le port 6607:
```bash
pm2 status
netstat -tulpn | grep 6607
```

### Le frontend n'est pas accessible
Vérifiez que le serveur frontend est en cours d'exécution sur le port 6608:
```bash
pm2 status
netstat -tulpn | grep 6608
```

### Problèmes avec Nginx
Vérifiez la configuration:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Problèmes avec le pare-feu
Vérifiez que les ports sont ouverts:
```bash
sudo ufw status
``` 