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

## Déploiement sur Netlify

Cette application est configurée pour être déployée facilement sur Netlify.

### Prérequis

- Un compte [Netlify](https://www.netlify.com/)
- Le code source accessible depuis GitHub, GitLab ou Bitbucket

### Étapes pour le déploiement

1. **Préparation des fichiers**

   Utilisez le script de configuration pour mettre en place les fichiers nécessaires :

   ```bash
   cd frontend
   chmod +x scripts/setup-netlify.sh
   ./scripts/setup-netlify.sh
   ```

   Cela créera automatiquement :
   - `netlify.toml` - Configuration principale pour Netlify
   - `_redirects` - Gestion des redirections SPA
   - `.env.production` - Variables d'environnement pour la production

2. **Déploiement sur Netlify**

   - Connectez-vous à votre compte Netlify
   - Cliquez sur "New site from Git"
   - Sélectionnez votre dépôt
   - Configurez les paramètres de build :
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Cliquez sur "Deploy site"

3. **Configuration des variables d'environnement**

   Les variables d'environnement sont déjà configurées dans `netlify.toml`, mais vous pouvez les ajuster dans l'interface Netlify si nécessaire :
   - `VUE_APP_API_URL`
   - `VUE_APP_SOCKET_URL`

### Problèmes connus

#### CORS et connexion à l'API

Si vous rencontrez des erreurs CORS, vérifiez que votre backend autorise le domaine de votre application Netlify dans sa configuration CORS.

#### Erreurs de chargement JavaScript

Si vous obtenez des erreurs comme `Unexpected token '<'` dans la console, cela peut indiquer un problème avec les routes SPA. Vérifiez que :
- Le fichier `_redirects` est bien copié dans le dossier `dist`
- La configuration `netlify.toml` est correcte
- Les chemins d'accès sont configurés correctement dans votre application Vue

## Développement local

Pour le développement local:
```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run serve
```

L'application sera accessible à l'adresse http://localhost:8080

## Configuration

Voir [Configuration Reference](https://cli.vuejs.org/config/).
