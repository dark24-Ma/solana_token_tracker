import axios from 'axios';
import socketIOClient from 'socket.io-client';

// Configuration des URLs d'API basée sur l'environnement
// En production (Vercel), nous utilisons l'URL de l'API déployée sur Vercel
// En développement, nous utilisons localhost
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://solana-token-tracker-api.vercel.app/api'
  : 'http://localhost:3000/api';

const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? 'https://solana-token-tracker-api.vercel.app'
  : 'http://localhost:3000';

// Création d'une instance axios avec l'URL de base et les configurations
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Création d'une instance socket.io
let socket = null;

// Fonction pour initialiser la connexion socket
const initSocket = () => {
  if (!socket) {
    // Les options correspondent à celles du serveur
    socket = socketIOClient(SOCKET_URL, {
      path: process.env.NODE_ENV === 'production' ? '/api/socket' : '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Connexion
    socket.on('connect', () => {
      console.log('Connecté au serveur via socket.io');
    });

    // Erreur de connexion
    socket.on('connect_error', (error) => {
      console.error('Erreur de connexion socket.io:', error);
    });

    // Reconnexion
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnecté au serveur après ${attemptNumber} tentatives`);
    });

    // Déconnexion
    socket.on('disconnect', (reason) => {
      console.log('Déconnecté du serveur:', reason);
    });
  }
  return socket;
};

// Fonction pour récupérer la liste des tokens
const getTokens = async () => {
  try {
    const response = await api.get('/tokens');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des tokens:', error);
    throw error;
  }
};

// Fonction pour récupérer les détails d'un token par son adresse
const getTokenByAddress = async (address) => {
  try {
    const response = await api.get(`/tokens/${address}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération du token ${address}:`, error);
    throw error;
  }
};

// Fonction pour vérifier manuellement les nouveaux tokens
const checkNewTokens = () => {
  if (!socket) {
    initSocket();
  }
  socket.emit('checkSolscan');
};

// Fonction pour obtenir le statut du système
const getSystemStatus = () => {
  if (!socket) {
    initSocket();
  }
  socket.emit('getSystemStatus');
};

// Fonction pour s'abonner aux événements de nouveaux tokens
const subscribeToNewTokens = (callback) => {
  if (!socket) {
    initSocket();
  }
  socket.on('newToken', callback);
  return () => socket.off('newToken', callback);
};

// Fonction pour s'abonner aux logs système
const subscribeToSystemLogs = (callback) => {
  if (!socket) {
    initSocket();
  }
  socket.on('systemLog', callback);
  return () => socket.off('systemLog', callback);
};

// Fonction pour s'abonner au nombre de clients connectés
const subscribeToClientCount = (callback) => {
  if (!socket) {
    initSocket();
  }
  socket.on('clientCount', callback);
  return () => socket.off('clientCount', callback);
};

// Fonction pour s'abonner au statut du système
const subscribeToSystemStatus = (callback) => {
  if (!socket) {
    initSocket();
  }
  socket.on('systemStatus', callback);
  return () => socket.off('systemStatus', callback);
};

// Fonction pour se déconnecter proprement
const disconnect = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Exporter les fonctions publiques
export {
  initSocket,
  getTokens,
  getTokenByAddress,
  checkNewTokens,
  getSystemStatus,
  subscribeToNewTokens,
  subscribeToSystemLogs,
  subscribeToClientCount,
  subscribeToSystemStatus,
  disconnect
}; 