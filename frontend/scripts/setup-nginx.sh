#!/bin/bash

# Script de configuration Nginx pour le frontend Solana Token Tracker
echo "Configuration Nginx pour Solana Token Tracker"
echo "----------------------------------------"

# Vérifier que le script est exécuté avec des privilèges root
if [ "$EUID" -ne 0 ]; then
  echo "Ce script doit être exécuté en tant que root"
  echo "Utilisez: sudo ./setup-nginx.sh"
  exit 1
fi

# Vérifier si Nginx est installé
if ! command -v nginx &> /dev/null; then
    echo "Nginx n'est pas installé. Installation de Nginx..."
    apt update
    apt install -y nginx
fi

# Demander le nom de domaine
echo "Entrez le nom de domaine pour votre application (ou laissez vide pour utiliser 185.97.146.99):"
read domain_name
domain_name=${domain_name:-185.97.146.99}

# Créer la configuration Nginx
echo "Création de la configuration Nginx..."
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
echo "Activation de la configuration..."
if [ -f /etc/nginx/sites-enabled/solana-token-tracker ]; then
    rm /etc/nginx/sites-enabled/solana-token-tracker
fi
ln -s /etc/nginx/sites-available/solana-token-tracker /etc/nginx/sites-enabled/

# Vérifier la configuration
echo "Vérification de la configuration Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    # Redémarrer Nginx
    echo "Redémarrage de Nginx..."
    systemctl restart nginx
    
    echo "Configuration Nginx terminée."
    
    # Configurer SSL avec Certbot
    if [[ "$domain_name" != "185.97.146.99" ]]; then
        echo "Voulez-vous configurer SSL avec Let's Encrypt ? (o/n)"
        read configure_ssl
        
        if [ "$configure_ssl" = "o" ]; then
            # Vérifier si Certbot est installé
            if ! command -v certbot &> /dev/null; then
                echo "Certbot n'est pas installé. Installation de Certbot..."
                apt install -y certbot python3-certbot-nginx
            fi
            
            # Obtenir le certificat SSL
            echo "Configuration de SSL avec Let's Encrypt..."
            certbot --nginx -d $domain_name -d api.$domain_name
            echo "SSL configuré avec Let's Encrypt."
        fi
    else
        echo "Note: Impossible de configurer SSL pour une adresse IP. Utilisez un nom de domaine pour SSL."
    fi
    
    echo "----------------------------------------"
    echo "L'application est accessible aux adresses suivantes:"
    echo "Frontend: http://$domain_name"
    echo "API: http://api.$domain_name"
    
    if [[ "$domain_name" != "185.97.146.99" && "$configure_ssl" = "o" ]]; then
        echo "Ou via HTTPS:"
        echo "Frontend: https://$domain_name"
        echo "API: https://api.$domain_name"
    fi
    
    echo "----------------------------------------"
else
    echo "Erreur dans la configuration Nginx. Veuillez vérifier et corriger les erreurs."
fi 