#!/bin/bash

# Script de déploiement pour le frontend Solana Token Tracker
echo "Déploiement du frontend Solana Token Tracker"
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

# Installer les dépendances
echo "Installation des dépendances..."
npm install

# Construire l'application
echo "Construction de l'application..."
npm run build

# Vérifier si la construction a réussi
if [ ! -d "dist" ]; then
    echo "Erreur: La construction a échoué. Le répertoire 'dist' n'existe pas."
    exit 1
fi

# Créer un fichier .env.production.local pour le port frontend si nécessaire
if [ ! -f ".env.production.local" ]; then
    echo "Création du fichier .env.production.local..."
    echo "VUE_APP_PORT=6608" > .env.production.local
fi

# Vérifier si l'application est déjà en cours d'exécution avec PM2
if pm2 list | grep -q "solana-tracker-frontend"; then
    echo "Redémarrage de l'application existante..."
    pm2 restart solana-tracker-frontend
else
    echo "Démarrage de l'application avec PM2..."
    pm2 start ecosystem.config.js
fi

# Sauvegarder la configuration PM2
echo "Sauvegarde de la configuration PM2..."
pm2 save

echo "----------------------------------------"
echo "Déploiement terminé !"
echo "L'application frontend est accessible à: http://185.97.146.99:6608"
echo "----------------------------------------"

# Afficher le statut PM2
echo "Statut actuel des applications PM2:"
pm2 status 