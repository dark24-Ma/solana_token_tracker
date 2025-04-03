#!/bin/bash

# Script de démarrage pour le frontend Solana Token Tracker
echo "Démarrage du frontend Solana Token Tracker sur le port 6608"
echo "----------------------------------------"

# Vérifier si PM2 est installé
if ! command -v pm2 &> /dev/null; then
    echo "PM2 n'est pas installé. Installation de PM2..."
    npm install -g pm2
fi

# Vérifier si serve est installé
if ! command -v serve &> /dev/null; then
    echo "serve n'est pas installé. Installation de serve..."
    npm install -g serve
fi

# Vérifier si le répertoire dist existe
if [ ! -d "dist" ]; then
    echo "Le répertoire 'dist' n'existe pas. Construction de l'application..."
    npm run build
    
    # Vérifier si la construction a réussi
    if [ ! -d "dist" ]; then
        echo "Erreur: La construction a échoué. Le répertoire 'dist' n'existe pas."
        exit 1
    fi
fi

# Vérifier si l'application est déjà en cours d'exécution avec PM2
if pm2 list | grep -q "solana-tracker-frontend"; then
    echo "L'application est déjà en cours d'exécution. Redémarrage..."
    pm2 restart solana-tracker-frontend
else
    echo "Démarrage de l'application avec PM2..."
    pm2 start ecosystem.config.js
fi

# Sauvegarder la configuration PM2
echo "Sauvegarde de la configuration PM2..."
pm2 save

echo "----------------------------------------"
echo "Le frontend est en cours d'exécution !"
echo "L'application est accessible à: http://185.97.146.99:6608"
echo "Pour voir les logs, utilisez: pm2 logs solana-tracker-frontend"
echo "Pour arrêter l'application, utilisez: pm2 stop solana-tracker-frontend"
echo "----------------------------------------"

# Afficher le statut PM2
echo "Statut actuel des applications PM2:"
pm2 status 