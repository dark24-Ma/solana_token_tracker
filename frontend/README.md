# Frontend - Solana Token Tracker

Ce répertoire contient le code frontend de l'application Solana Token Tracker.

## Ports de l'application
- **Backend (API)**: Port 6607
- **Frontend**: Port 6608

## Déploiement avec PM2

Pour déployer le frontend en production, suivez ces étapes:

### 1. Prérequis
- Node.js (v16 ou plus)
- npm
- PM2 (`npm install -g pm2`)
- serve (`npm install -g serve`)

### 2. Construction de l'application
```bash
# Installer les dépendances
npm install

# Construire l'application
npm run build
```

### 3. Configuration pour le déploiement

Un fichier `ecosystem.config.js` est déjà configuré pour le déploiement avec PM2:

```javascript
module.exports = {
  apps: [
    {
      name: 'solana-tracker-frontend',
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
```

### 4. Démarrer l'application avec PM2
```bash
# Démarrer l'application
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2 pour un redémarrage automatique
pm2 save

# Configurer le démarrage automatique au boot (si nécessaire)
pm2 startup
```

### 5. Accès à l'application
Une fois déployée, l'application sera accessible à l'adresse:
- http://185.97.146.99:6608 (ou votre nom de domaine)

## Développement local

Pour le développement local:
```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run serve
```

L'application sera accessible à l'adresse http://localhost:8080
