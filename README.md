# 🚀 Solana Token Tracker

Une application moderne et responsive permettant de suivre en temps réel les nouveaux tokens sur la blockchain Solana.

![Solana Token Tracker](https://solana.com/src/images/branding/solanaLogoMark.svg)

## ✨ Fonctionnalités

- 🔍 **Suivi en temps réel** des nouveaux tokens Solana
- 🔔 **Notifications instantanées** lors de la détection de nouveaux tokens
- 🌙 **Mode sombre** élégant et moderne
- 📱 Interface **responsive** adaptée à tous les appareils
- 📊 Affichage détaillé des informations sur les tokens
- 🔄 Filtrage et tri des tokens par différents critères
- 🔗 Liens directs vers Solscan pour plus de détails

## 🛠️ Technologies utilisées

### Frontend
- **Vue.js 3** avec Composition API
- **Bootstrap 5** pour le design responsive
- **Socket.io client** pour les communications en temps réel
- **Font Awesome** pour les icônes
- **Poppins** comme police principale

### Backend
- **Node.js** avec Express
- **MongoDB** pour le stockage des données
- **Socket.io** pour les notifications en temps réel
- **API Solana Web3.js** pour l'interaction avec la blockchain
- **Système de queue** pour la gestion des requêtes API

## 🚀 Installation

### Prérequis
- Node.js (v14+)
- MongoDB
- Git

### Étapes d'installation

1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/votreusername/solana-token-tracker.git
   cd solana-token-tracker
   ```

2. **Installer les dépendances du backend**
   ```bash
   cd backend
   npm install
   ```

3. **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env
   # Modifiez le fichier .env avec vos propres informations
   ```

4. **Installer les dépendances du frontend**
   ```bash
   cd ../frontend
   npm install
   ```

## 🖥️ Démarrage de l'application

1. **Démarrer le serveur backend**
   ```bash
   cd backend
   npm start
   ```

2. **Démarrer le serveur frontend**
   ```bash
   cd frontend
   npm run serve
   ```

3. **Accéder à l'application**
   Ouvrez votre navigateur à l'adresse [http://localhost:8080](http://localhost:8080)

## 📸 Captures d'écran

![Dashboard](path/to/dashboard-screenshot.png)
![Token Details](path/to/token-details-screenshot.png)

## 📝 Développement

### Structure du projet
```
solana-token-tracker/
├── backend/               # Serveur Node.js
│   ├── src/
│   │   ├── controllers/   # Contrôleurs
│   │   ├── models/        # Modèles MongoDB
│   │   ├── routes/        # Routes API
│   │   ├── services/      # Services (Solana, etc.)
│   │   └── utils/         # Utilitaires
│   └── index.js           # Point d'entrée du backend
└── frontend/              # Application Vue.js
    ├── public/            # Fichiers statiques
    └── src/
        ├── assets/        # Images, fonts, etc.
        ├── components/    # Composants Vue
        ├── router/        # Configuration des routes
        ├── utils/         # Fonctions utilitaires
        ├── App.vue        # Composant racine
        └── main.js        # Point d'entrée du frontend
```

## 🔄 API Endpoints

- `GET /api/tokens` - Récupérer la liste des tokens
- `GET /api/tokens/:address` - Récupérer les détails d'un token spécifique
- `GET /api/stats` - Obtenir des statistiques globales

## 📜 Licence

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou à soumettre une pull request.

1. Forkez le projet
2. Créez votre branche (`git checkout -b feature/amazing-feature`)
3. Committez vos changements (`git commit -m 'Add some amazing feature'`)
4. Pushez vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request

## 📧 Contact

Votre Nom - [@votretwitter](https://twitter.com/votretwitter) - email@example.com

Lien du projet: [https://github.com/votreusername/solana-token-tracker](https://github.com/votreusername/solana-token-tracker) 