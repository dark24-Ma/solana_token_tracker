const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { Connection } = require('@solana/web3.js');
const tokenRoutes = require('./routes/tokenRoutes');
const SolanaWatcher = require('./services/solanaWatcher');
const SolanaService = require('./services/solanaService');
const { createServer } = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

// Configuration globale d'axios pour éviter d'être bloqué par les API
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
axios.defaults.headers.common['Accept'] = 'application/json, text/plain, */*';
axios.defaults.headers.common['Accept-Language'] = 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7';
axios.defaults.headers.common['Referer'] = 'https://solscan.io/';
axios.defaults.headers.common['Origin'] = 'https://solscan.io';
axios.defaults.timeout = 15000; // Timeout de 15 secondes

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:8080", "http://127.0.0.1:8080"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  },
  pingTimeout: 60000, // Augmenter le timeout ping
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Nombre de clients connectés
let connectedClients = 0;

// Gestion des erreurs de connexion MongoDB
const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/solana_tracker');
    console.log('Connecté à MongoDB');
    io.emit('systemLog', { type: 'success', message: 'Connecté à MongoDB' });
    return true;
  } catch (err) {
    console.error('Erreur de connexion à MongoDB:', err);
    io.emit('systemLog', { type: 'error', message: 'Erreur de connexion à MongoDB: ' + err.message });
    return false;
  }
};

// Configuration Solana avec gestion d'erreur
const connectToSolana = () => {
  try {
    console.log("Connexion au réseau Solana mainnet...");
    const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const solanaConnection = new Connection(solanaRpcUrl, 'confirmed');
    console.log(`Connecté au point de terminaison RPC Solana: ${solanaRpcUrl}`);
    io.emit('systemLog', { type: 'success', message: `Connecté au réseau Solana (${solanaRpcUrl})` });
    return solanaConnection;
  } catch (error) {
    console.error("Erreur lors de la connexion à Solana:", error);
    io.emit('systemLog', { type: 'error', message: 'Erreur de connexion à Solana: ' + error.message });
    return null;
  }
};

// Routes
app.use('/api/tokens', tokenRoutes);

// Route de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Solana Token Tracker',
    version: '1.0.0',
    status: 'running',
    connections: connectedClients,
    endpoints: {
      tokens: '/api/tokens',
      tokenByAddress: '/api/tokens/:address'
    }
  });
});

// Socket.io events
io.on('connection', (socket) => {
  connectedClients++;
  console.log(`Nouveau client connecté. Total clients: ${connectedClients}`);
  
  // Envoyer un message d'accueil
  socket.emit('systemLog', { 
    type: 'info', 
    message: `Connecté au serveur. ${connectedClients} client(s) actif(s).` 
  });
  
  // Diffuser le nombre de connexions à tous les clients
  io.emit('clientCount', { count: connectedClients });
  
  // Gestion de la déconnexion
  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`Client déconnecté. Total clients: ${connectedClients}`);
    io.emit('clientCount', { count: connectedClients });
  });
  
  // Le client peut demander une vérification manuelle de Solscan
  socket.on('checkSolscan', () => {
    if (global.solanaWatcher) {
      socket.emit('systemLog', { type: 'info', message: 'Vérification manuelle de Solscan initiée' });
      global.solanaWatcher.checkSolscanNewTokens()
        .then(() => {
          socket.emit('systemLog', { type: 'success', message: 'Vérification de Solscan terminée' });
        })
        .catch(err => {
          socket.emit('systemLog', { type: 'error', message: 'Erreur lors de la vérification de Solscan: ' + err.message });
        });
    } else {
      socket.emit('systemLog', { type: 'error', message: 'SolanaWatcher non initialisé' });
    }
  });
  
  // Le client demande le statut du système
  socket.on('getSystemStatus', async () => {
    try {
      // Vérifier la connexion à MongoDB
      const isMongoConnected = mongoose.connection.readyState === 1;
      
      // Vérifier le nombre de tokens
      let tokenCount = 0;
      if (isMongoConnected) {
        tokenCount = await mongoose.connection.db.collection('tokens').countDocuments();
      }
      
      // Récupérer les informations de Solana
      const solanaEndpoint = global.solanaConnection ? 
        (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com') : 
        null;
      
      // Vérifier si le watcher est actif
      const isWatching = global.solanaWatcher ? global.solanaWatcher.isWatching : false;
      
      // Envoyer toutes les informations au client
      socket.emit('systemStatus', {
        connectedToMongoDB: isMongoConnected,
        connectedToSolana: !!global.solanaConnection,
        solanaEndpoint,
        tokenCount,
        clientCount: connectedClients,
        isWatching,
        serverTime: new Date().toISOString()
      });
      
      socket.emit('systemLog', { 
        type: 'info', 
        message: 'Statut du système vérifié avec succès' 
      });
    } catch (error) {
      console.error("Erreur lors de la récupération du statut:", error);
      socket.emit('systemLog', { 
        type: 'error', 
        message: 'Erreur lors de la récupération du statut: ' + error.message 
      });
    }
  });
});

// Fonction principale
const startServer = async () => {
  // Connexion à MongoDB
  const isMongoConnected = await connectToMongoDB();
  if (!isMongoConnected) {
    console.log("Impossible de démarrer le serveur sans connexion MongoDB. Nouvelle tentative dans 10 secondes...");
    io.emit('systemLog', { type: 'warning', message: 'Tentative de reconnexion à MongoDB dans 10 secondes...' });
    setTimeout(startServer, 10000);
    return;
  }

  // Connexion à Solana
  const solanaConnection = connectToSolana();
  if (!solanaConnection) {
    console.log("Impossible de démarrer le serveur sans connexion Solana. Nouvelle tentative dans 10 secondes...");
    io.emit('systemLog', { type: 'warning', message: 'Tentative de reconnexion à Solana dans 10 secondes...' });
    setTimeout(startServer, 10000);
    return;
  }

  // Rendre la connexion accessible globalement
  global.solanaConnection = solanaConnection;

  // Initialiser le service Solana
  const solanaService = new SolanaService(solanaConnection);

  // Initialiser le watcher et le rendre global pour y accéder dans les événements socket
  const solanaWatcher = new SolanaWatcher(solanaConnection, io, solanaService);
  global.solanaWatcher = solanaWatcher;

  // Démarrer la surveillance une fois la connexion à la base de données établie
  mongoose.connection.once('open', async () => {
    console.log("Initialisation de la surveillance des tokens Solana...");
    io.emit('systemLog', { type: 'info', message: 'Initialisation de la surveillance des tokens Solana...' });
    
    try {
      // Vérifier s'il y a des tokens existants, sinon en récupérer quelques-uns pour commencer
      const tokenCount = await mongoose.connection.db.collection('tokens').countDocuments();
      if (tokenCount === 0) {
        console.log("Aucun token trouvé en base de données. Récupération des tokens récents...");
        io.emit('systemLog', { type: 'info', message: 'Récupération des premiers tokens...' });
        
        try {
          const initialTokens = await solanaService.getRecentTokens(10);
          console.log(`${initialTokens.length} tokens initiaux récupérés et sauvegardés`);
          io.emit('systemLog', { type: 'success', message: `${initialTokens.length} tokens initiaux récupérés` });
        } catch (initError) {
          console.warn("Erreur lors de la récupération des tokens initiaux:", initError.message);
          io.emit('systemLog', { type: 'warning', message: 'Erreur lors de la récupération des tokens initiaux' });
        }
      } else {
        console.log(`${tokenCount} tokens trouvés en base de données`);
        io.emit('systemLog', { type: 'info', message: `${tokenCount} tokens existants en base de données` });
      }
      
      // Démarrer la surveillance
      console.log("Démarrage de la surveillance des tokens Solana...");
      io.emit('systemLog', { type: 'info', message: 'Démarrage de la surveillance des nouveaux tokens...' });
      solanaWatcher.startWatching();
      
      io.emit('systemLog', { type: 'success', message: 'Système de surveillance démarré avec succès' });
    } catch (error) {
      console.error("Erreur lors de l'initialisation:", error);
      io.emit('systemLog', { type: 'error', message: "Erreur lors de l'initialisation: " + error.message });
    }
  });

  // Gestion de l'arrêt propre
  process.on('SIGINT', async () => {
    console.log("Arrêt du serveur...");
    io.emit('systemLog', { type: 'warning', message: 'Arrêt du serveur en cours...' });
    solanaWatcher.stopWatching();
    await mongoose.connection.close();
    console.log("Connexions fermées. Au revoir!");
    process.exit(0);
  });

  // Démarrer le serveur
  httpServer.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
};

// Démarrer le serveur
startServer(); 