const { Server } = require('socket.io');

/**
 * Configurer et créer une instance Socket.io avec les paramètres CORS appropriés
 * @param {Object} httpServer - Le serveur HTTP Node.js
 * @returns {Object} Instance Socket.io configurée
 */
function createSocketServer(httpServer) {
  // Liste des origines autorisées
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    [
      "http://localhost:8080",
      "http://localhost:6608",
      "http://127.0.0.1:8080",
      "https://solana-snipper-bot.vercel.app",
      "https://solana-token-tracker.vercel.app",
      "https://solana-token-tracker-bb9j.vercel.app",
      "http://185.97.146.99:6608"
    ];

  console.log("Origines autorisées pour Socket.io:", allowedOrigins);
  
  // Créer l'instance Socket.io avec configuration CORS
  const io = new Server(httpServer, {
    cors: {
      origin: function(origin, callback) {
        // Permettre les requêtes sans origine (comme les connexions WebSocket directes)
        if (!origin) return callback(null, true);
        
        // Vérifier si l'origine est autorisée ou si c'est une IP spécifique
        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('185.97.146.99')) {
          return callback(null, true);
        }
        
        // En développement, autoriser toutes les origines
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        
        console.log(`Origine Socket.io non autorisée: ${origin}`);
        return callback(null, false);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
      credentials: true
    },
    // Augmenter les timeouts pour éviter les déconnexions
    pingTimeout: 60000,
    pingInterval: 25000,
    // Autoriser les transports alternatifs si WebSocket est bloqué
    transports: ['websocket', 'polling'],
    // S'assurer que le socket tente de se reconnecter
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    // Allow JSONP for environments that block WebSockets
    allowEIO3: true
  });

  // Configuration de base des événements
  io.on('connection', (socket) => {
    console.log(`Nouveau client connecté. ID: ${socket.id}`);
    
    // Envoyer un message de bienvenue
    socket.emit('welcome', { 
      message: 'Connecté au serveur Socket.io', 
      socketId: socket.id,
      serverTime: new Date().toISOString()
    });
    
    // Gestion de la déconnexion
    socket.on('disconnect', (reason) => {
      console.log(`Client déconnecté. ID: ${socket.id}, Raison: ${reason}`);
    });
    
    // Gestion des erreurs
    socket.on('error', (error) => {
      console.error(`Erreur Socket.io. ID: ${socket.id}`, error);
    });
  });

  return io;
}

module.exports = createSocketServer; 