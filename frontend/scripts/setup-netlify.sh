#!/bin/bash

# Script pour configurer le déploiement Netlify

# Créer le dossier scripts s'il n'existe pas
mkdir -p scripts

# Vérifier si les fichiers Netlify existent
if [ ! -f "netlify.toml" ]; then
  echo "Création du fichier netlify.toml..."
  cat > netlify.toml << EOL
[build]
  command = "npm run build"
  publish = "dist"

[context.production.environment]
  VUE_APP_API_URL = "http://185.97.146.99:6607/api"
  VUE_APP_SOCKET_URL = "http://185.97.146.99:6607"
  NODE_ENV = "production"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
EOL
fi

if [ ! -f "_redirects" ]; then
  echo "Création du fichier _redirects..."
  echo "/* /index.html 200" > _redirects
fi

# Vérifier si vue.config.js existe et s'il contient la configuration Netlify
if [ ! -f "vue.config.js" ] || ! grep -q "netlify.toml" vue.config.js; then
  echo "Mise à jour du fichier vue.config.js..."
  cat > vue.config.js << EOL
module.exports = {
  publicPath: '/',
  productionSourceMap: false,
  // Assurer que les fichiers statiques sont correctement générés
  configureWebpack: {
    output: {
      filename: '[name].[hash].js'
    }
  },
  // Copier les fichiers Netlify dans le dossier dist lors du build
  chainWebpack: config => {
    config.plugin('copy')
      .tap(args => {
        args[0].push({
          from: 'netlify.toml',
          to: './'
        });
        args[0].push({
          from: '_redirects',
          to: './'
        });
        return args;
      });
  }
}
EOL
fi

# Créer un fichier .env.production s'il n'existe pas
if [ ! -f ".env.production" ]; then
  echo "Création du fichier .env.production..."
  cat > .env.production << EOL
NODE_ENV=production
VUE_APP_API_URL=http://185.97.146.99:6607/api
VUE_APP_SOCKET_URL=http://185.97.146.99:6607
EOL
fi

echo "Configuration pour Netlify terminée!"
echo "Pour déployer sur Netlify:"
echo "1. Créez un nouveau site sur Netlify"
echo "2. Connectez votre dépôt GitHub"
echo "3. Configurez le build avec les paramètres suivants:"
echo "   - Build command: npm run build"
echo "   - Publish directory: dist"
echo "4. Déployez!" 