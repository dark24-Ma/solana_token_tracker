#!/bin/bash

# Script d'installation pour Solana Token Tracker sur VPS
echo "Installation de Solana Token Tracker sur VPS"
echo "----------------------------------------"

# Vérifier que le script est exécuté avec des privilèges root
if [ "$EUID" -ne 0 ]; then
  echo "Ce script doit être exécuté en tant que root"
  echo "Utilisez: sudo ./install_vps.sh"
  exit 1
fi

# Mise à jour du système
echo "Mise à jour du système..."
apt update && apt upgrade -y

# Installation des dépendances
echo "Installation des dépendances système..."
apt install -y curl wget git build-essential htop nginx ufw

# Installation de Node.js 16.x
echo "Installation de Node.js..."
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt install -y nodejs

# Vérifier la version de Node.js
node -v
npm -v

# Installation de PM2 pour la gestion des processus
echo "Installation de PM2..."
npm install -g pm2

# Installation de MongoDB (si pas de base de données externe)
echo "Souhaitez-vous installer MongoDB localement ? (o/n)"
read install_mongodb

if [ "$install_mongodb" = "o" ]; then
  echo "Installation de MongoDB..."
  wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | apt-key add -
  echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-5.0.list
  apt update
  apt install -y mongodb-org
  
  # Démarrer et activer MongoDB
  systemctl start mongod
  systemctl enable mongod
  
  echo "MongoDB installé et démarré."
else
  echo "MongoDB ne sera pas installé localement."
  echo "N'oubliez pas de configurer la variable d'environnement MONGODB_URI."
fi

# Configurer le pare-feu
echo "Configuration du pare-feu..."
ufw allow ssh
ufw allow http
ufw allow https
# Ports spécifiques pour l'application
ufw allow 6607 # Backend
ufw allow 6608 # Frontend

# Activer le pare-feu
echo "Activer le pare-feu ? (o/n)"
read enable_firewall
if [ "$enable_firewall" = "o" ]; then
  ufw enable
  ufw status
fi

# Cloner le dépôt (optionnel)
echo "Voulez-vous cloner le dépôt GitHub ? (o/n)"
read clone_repo
if [ "$clone_repo" = "o" ]; then
  echo "Entrez l'URL du dépôt GitHub:"
  read repo_url
  
  echo "Dans quel répertoire souhaitez-vous cloner le projet ? (défaut: /var/www/solana-token-tracker)"
  read install_dir
  install_dir=${install_dir:-/var/www/solana-token-tracker}
  
  mkdir -p $install_dir
  cd $install_dir
  git clone $repo_url .
  
  # Installation des dépendances
  echo "Installation des dépendances du projet..."
  cd backend
  npm install
  
  # Créer le fichier .env
  echo "Configuration du fichier .env..."
  cp .env.example .env
  
  # Demander la configuration MongoDB
  if [ "$install_mongodb" != "o" ]; then
    echo "Entrez l'URI MongoDB:"
    read mongodb_uri
    sed -i "s|MONGODB_URI=.*|MONGODB_URI=$mongodb_uri|g" .env
  fi
  
  # Demander l'URL RPC Solana
  echo "Entrez l'URL RPC Solana (défaut: https://api.mainnet-beta.solana.com):"
  read solana_rpc
  solana_rpc=${solana_rpc:-https://api.mainnet-beta.solana.com}
  sed -i "s|SOLANA_RPC_URL=.*|SOLANA_RPC_URL=$solana_rpc|g" .env
  
  # Configuration des origines CORS
  echo "Entrez l'URL de votre frontend (défaut: http://185.97.146.99:6608):"
  read frontend_url
  frontend_url=${frontend_url:-http://185.97.146.99:6608}
  sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$frontend_url,http://localhost:6608,http://127.0.0.1:6608|g" .env
  
  # S'assurer que le port est correctement configuré
  sed -i "s|PORT=.*|PORT=6607|g" .env
  
  # Démarrer l'application avec PM2
  echo "Démarrage de l'application avec PM2..."
  pm2 start ecosystem.config.js
  pm2 save
  pm2 startup
  
  echo "L'application backend est démarrée et configurée pour démarrer au boot."
  
  # Installation du frontend
  echo "Voulez-vous configurer le frontend ? (o/n)"
  read install_frontend
  if [ "$install_frontend" = "o" ]; then
    cd ../frontend
    npm install
    
    # Créer un fichier .env.production local pour le port frontend
    echo "VUE_APP_PORT=6608" > .env.production.local
    
    # Construction du frontend
    npm run build
    
    # Configuration du serveur pour le frontend
    echo "Installation de serve pour le frontend..."
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
    
    echo "Le frontend est configuré et démarré sur le port 6608."
  fi
fi

# Configuration Nginx pour le proxy (optionnel)
echo "Voulez-vous configurer Nginx comme proxy pour l'application ? (o/n)"
read configure_nginx
if [ "$configure_nginx" = "o" ]; then
  echo "Entrez le nom de domaine pour votre application (ou laissez vide pour l'adresse IP 185.97.146.99):"
  read domain_name
  domain_name=${domain_name:-185.97.146.99}
  
  # Créer la configuration Nginx
  cat > /etc/nginx/sites-available/solana-token-tracker << EOF
# Configuration pour le backend (API)
server {
    listen 80;
    server_name api.$domain_name;

    location / {
        proxy_pass http://localhost:6607;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}

# Configuration pour le frontend
server {
    listen 80;
    server_name $domain_name;

    location / {
        proxy_pass http://localhost:6608;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

  # Activer le site
  ln -s /etc/nginx/sites-available/solana-token-tracker /etc/nginx/sites-enabled/
  
  # Vérifier la configuration
  nginx -t
  
  # Redémarrer Nginx
  systemctl restart nginx
  
  echo "Configuration Nginx terminée."
  
  # Configurer SSL avec Certbot
  echo "Voulez-vous configurer SSL avec Let's Encrypt ? (o/n)"
  read configure_ssl
  if [ "$configure_ssl" = "o" ]; then
    # Installation de Certbot
    apt install -y certbot python3-certbot-nginx
    
    # Obtenir le certificat SSL
    if [[ "$domain_name" != "185.97.146.99" ]]; then
      certbot --nginx -d $domain_name -d api.$domain_name
      echo "SSL configuré avec Let's Encrypt."
    else
      echo "Impossible de configurer SSL pour une adresse IP. Utilisez un nom de domaine."
    fi
  fi
fi

echo "----------------------------------------"
echo "Installation terminée !"
echo "Votre serveur Solana Token Tracker est configuré et prêt à l'emploi."
echo "Backend: http://185.97.146.99:6607"
echo "Frontend: http://185.97.146.99:6608"
echo "----------------------------------------" 