/**
 * Script d'initialisation Socket.io pour Solana Token Tracker API
 * Ce script facilite la connexion à l'API Socket.io depuis un client distant
 * en gérant les problèmes CORS courants.
 */

(function(window) {
  // Option de configuration par défaut
  const DEFAULT_CONFIG = {
    apiUrl: 'https://solana-token-tracker-api.vercel.app',
    transports: ['polling', 'websocket'], // Essayer polling d'abord, puis websocket
    autoConnect: false, // Ne pas se connecter automatiquement
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    withCredentials: true,
    forceNew: true,
    extraHeaders: {},
    debug: false
  };

  /**
   * Classe SolanaSocketClient pour gérer la connexion Socket.io
   */
  class SolanaSocketClient {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.socket = null;
      this.callbacks = {
        connect: [],
        disconnect: [],
        error: [],
        reconnect: [],
        newToken: [],
        systemLog: [],
        clientCount: [],
        systemStatus: []
      };
      
      this.log(`SolanaSocketClient initialisé avec: ${this.config.apiUrl}`);
      
      if (this.config.autoConnect) {
        this.connect();
      }
    }
    
    /**
     * Fonction de journalisation interne
     */
    log(message, type = 'info') {
      if (this.config.debug) {
        console[type === 'error' ? 'error' : 'log'](`[SolanaSocketClient] ${message}`);
      }
    }
    
    /**
     * Se connecter au serveur Socket.io
     */
    connect() {
      if (this.socket) {
        this.log('Une connexion existe déjà, déconnexion en cours...');
        this.socket.disconnect();
      }
      
      this.log(`Tentative de connexion à ${this.config.apiUrl}`);
      
      try {
        // Vérifier si Socket.io est disponible
        if (!window.io) {
          throw new Error('Socket.io n\'est pas chargé. Assurez-vous d\'inclure la bibliothèque Socket.io.');
        }
        
        // Initialiser Socket.io avec configuration spéciale pour éviter les problèmes CORS
        this.socket = window.io(this.config.apiUrl, {
          transports: this.config.transports,
          reconnection: this.config.reconnection,
          reconnectionAttempts: this.config.reconnectionAttempts,
          reconnectionDelay: this.config.reconnectionDelay,
          timeout: this.config.timeout,
          withCredentials: this.config.withCredentials,
          forceNew: this.config.forceNew,
          extraHeaders: {
            ...this.config.extraHeaders,
            'Origin': window.location.origin
          }
        });
        
        // Configurer les gestionnaires d'événements internes
        this._setupEventHandlers();
        
        return true;
      } catch (error) {
        this.log(`Erreur lors de l'initialisation de Socket.io: ${error.message}`, 'error');
        return false;
      }
    }
    
    /**
     * Configurer les gestionnaires d'événements Socket.io
     */
    _setupEventHandlers() {
      if (!this.socket) return;
      
      // Événements de base Socket.io
      this.socket.on('connect', () => {
        this.log('Connecté au serveur Socket.io!');
        this._triggerCallbacks('connect', { id: this.socket.id });
      });
      
      this.socket.on('connect_error', (error) => {
        this.log(`Erreur de connexion: ${error.message}`, 'error');
        this._triggerCallbacks('error', { message: error.message, type: 'connect_error' });
      });
      
      this.socket.on('disconnect', (reason) => {
        this.log(`Déconnecté: ${reason}`);
        this._triggerCallbacks('disconnect', { reason });
      });
      
      this.socket.on('reconnect', (attemptNumber) => {
        this.log(`Reconnecté après ${attemptNumber} tentatives`);
        this._triggerCallbacks('reconnect', { attemptNumber });
      });
      
      // Événements spécifiques de l'API
      this.socket.on('welcome', (data) => {
        this.log(`Message de bienvenue reçu: ${JSON.stringify(data)}`);
      });
      
      this.socket.on('newToken', (token) => {
        this.log(`Nouveau token détecté: ${token.name} (${token.symbol})`);
        this._triggerCallbacks('newToken', token);
      });
      
      this.socket.on('systemLog', (data) => {
        this.log(`Log système: ${data.message}`, data.type === 'error' ? 'error' : 'info');
        this._triggerCallbacks('systemLog', data);
      });
      
      this.socket.on('clientCount', (data) => {
        this.log(`Nombre de clients connectés: ${data.count}`);
        this._triggerCallbacks('clientCount', data);
      });
      
      this.socket.on('systemStatus', (status) => {
        this.log('Statut du système reçu');
        this._triggerCallbacks('systemStatus', status);
      });
    }
    
    /**
     * Déclencher les callbacks enregistrés pour un événement
     */
    _triggerCallbacks(event, data) {
      if (this.callbacks[event]) {
        this.callbacks[event].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            this.log(`Erreur dans le callback ${event}: ${error.message}`, 'error');
          }
        });
      }
    }
    
    /**
     * Se déconnecter du serveur
     */
    disconnect() {
      if (this.socket) {
        this.socket.disconnect();
        this.log('Déconnecté manuellement du serveur');
      }
    }
    
    /**
     * Enregistrer un callback pour un événement
     */
    on(event, callback) {
      if (this.callbacks[event]) {
        this.callbacks[event].push(callback);
        this.log(`Callback ajouté pour l'événement: ${event}`);
      } else {
        this.log(`Événement non reconnu: ${event}`, 'error');
      }
      return this;
    }
    
    /**
     * Émettre un événement au serveur
     */
    emit(event, data) {
      if (this.socket && this.socket.connected) {
        this.socket.emit(event, data);
        this.log(`Événement émis: ${event}`);
        return true;
      } else {
        this.log(`Impossible d'émettre ${event}: non connecté`, 'error');
        return false;
      }
    }
    
    /**
     * Vérifier si le client est connecté
     */
    isConnected() {
      return this.socket && this.socket.connected;
    }
    
    /**
     * Obtenir l'ID du socket
     */
    getSocketId() {
      return this.socket ? this.socket.id : null;
    }
    
    /**
     * Demander une vérification des tokens
     */
    checkTokens() {
      return this.emit('checkSolscan');
    }
  }
  
  // Exporter globalement
  window.SolanaSocketClient = SolanaSocketClient;
  
})(window); 