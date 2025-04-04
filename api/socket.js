// Point d'entrée pour les WebSockets avec Vercel
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { Connection } = require('@solana/web3.js');
const SolanaService = require('../src/services/solanaService');
const SolanaWatcher = require('../src/services/solanaWatcher');

module.exports = (req, res) => {
  if (res.socket.server.io) {
    // Socket.io est déjà configuré
    console.log('Socket.io est déjà configuré');
    res.end();
    return;
  }

  // Configuration de Socket.io
  const io = new Server(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: function(origin, callback) {
        // Autoriser les requêtes sans origine
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
          "http://localhost:8080", 
          "http://localhost:6608", 
          "http://127.0.0.1:8080",
          "https://solana-snipper-bot.vercel.app",
          "https://solana-token-tracker.vercel.app",
          "https://solana-token-tracker-bb9j.vercel.app"
        ];
        
        // Vérifier si l'origine est autorisée
        if (allowedOrigins.indexOf(origin) === -1) {
          console.log(`Origine non autorisée pour socket.io: ${origin}`);
          // Autoriser quand même en développement
          if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
          }
          
          return callback(new Error('CORS non autorisé pour socket.io'), false);
        }
        return callback(null, true);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
      credentials: true
    }
  });

  // Nombre de clients connectés
  let connectedClients = 0;

  // Connexion à MongoDB
  const connectToMongoDB = async () => {
    if (mongoose.connection.readyState === 1) {
      console.log('Déjà connecté à MongoDB');
      return true;
    }

    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('Connecté à MongoDB');
      io.emit('systemLog', { type: 'success', message: 'Connecté à MongoDB' });
      return true;
    } catch (err) {
      console.error('Erreur de connexion à MongoDB:', err);
      io.emit('systemLog', { type: 'error', message: 'Erreur de connexion à MongoDB: ' + err.message });
      return false;
    }
  };

  // Connexion à Solana
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

  // Initialisation des services
  const initializeServices = async () => {
    const isMongoConnected = await connectToMongoDB();
    if (!isMongoConnected) {
      console.log("Impossible d'initialiser sans connexion MongoDB");
      return false;
    }

    const solanaConnection = connectToSolana();
    if (!solanaConnection) {
      console.log("Impossible d'initialiser sans connexion Solana");
      return false;
    }

    // Initialiser le service Solana
    const solanaService = new SolanaService(solanaConnection);

    // Initialiser le watcher
    const solanaWatcher = new SolanaWatcher(solanaConnection, io, solanaService);

    // Démarrer la surveillance
    console.log("Démarrage de la surveillance des tokens Solana...");
    io.emit('systemLog', { type: 'info', message: 'Démarrage de la surveillance des nouveaux tokens...' });
    solanaWatcher.startWatching();

    // Stocker le watcher pour pouvoir y accéder plus tard
    res.socket.server.solanaWatcher = solanaWatcher;
    res.socket.server.solanaService = solanaService;
    res.socket.server.solanaConnection = solanaConnection;

    return true;
  };

  // Socket.io events
  io.on('connection', async (socket) => {
    connectedClients++;
    console.log(`Nouveau client connecté. Total clients: ${connectedClients}`);
    
    // Envoyer un message d'accueil
    socket.emit('systemLog', { 
      type: 'info', 
      message: `Connecté au serveur. ${connectedClients} client(s) actif(s).` 
    });
    
    // Diffuser le nombre de connexions à tous les clients
    io.emit('clientCount', { count: connectedClients });
    
    // Initialiser les services si nécessaire
    if (!res.socket.server.solanaWatcher) {
      await initializeServices();
    }
    
    // Gestion de la déconnexion
    socket.on('disconnect', () => {
      connectedClients--;
      console.log(`Client déconnecté. Total clients: ${connectedClients}`);
      io.emit('clientCount', { count: connectedClients });
    });
    
    // Le client peut demander une vérification manuelle de Solscan
    socket.on('checkSolscan', () => {
      if (res.socket.server.solanaWatcher) {
        socket.emit('systemLog', { type: 'info', message: 'Vérification manuelle des tokens initiée' });
        
        // Utiliser la méthode checkManually pour une meilleure gestion des erreurs
        res.socket.server.solanaWatcher.checkManually()
          .then(success => {
            if (success) {
              socket.emit('systemLog', { 
                type: 'success', 
                message: 'Vérification manuelle terminée avec succès'
              });
            } else {
              socket.emit('systemLog', { 
                type: 'warning', 
                message: 'Vérification terminée avec des avertissements'
              });
            }
          })
          .catch(err => {
            socket.emit('systemLog', { 
              type: 'error', 
              message: 'Erreur lors de la vérification: ' + err.message 
            });
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
        const solanaEndpoint = res.socket.server.solanaConnection ? 
          (process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com') : 
          null;
        
        // Vérifier si le watcher est actif
        const isWatching = res.socket.server.solanaWatcher ? res.socket.server.solanaWatcher.isWatching : false;
        
        // Envoyer toutes les informations au client
        socket.emit('systemStatus', {
          connectedToMongoDB: isMongoConnected,
          connectedToSolana: !!res.socket.server.solanaConnection,
          solanaEndpoint,
          tokenCount,
          clientCount: connectedClients,
          isWatching,
          serverTime: new Date().toISOString(),
          environment: 'production'
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

  // Stocker io pour réutilisation dans les prochaines requêtes
  res.socket.server.io = io;

  // Terminer la requête
  console.log('Socket.io démarré');
  res.end();
}; 