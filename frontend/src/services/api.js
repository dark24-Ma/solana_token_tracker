import axios from 'axios';
import io from 'socket.io-client';

// Configuration des URLs d'API et de Socket
// Pour le déploiement:
// 1. Le backend est sur le VPS à l'adresse 185.97.146.99 port 6607
// 2. Le frontend est déployé sur Netlify

// URL de base pour l'API - Environnement de production vs développement
const API_BASE_URL = process.env.VUE_APP_API_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'http://185.97.146.99:6607/api'  // URL de production sur le VPS
    : 'http://localhost:6607/api');    // URL de développement

// URL pour les connexions Socket.io
const SOCKET_URL = process.env.VUE_APP_SOCKET_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'http://185.97.146.99:6607'      // URL de production sur le VPS
    : 'http://localhost:6607');        // URL de développement

console.log('Environnement:', process.env.NODE_ENV);
console.log('API_BASE_URL:', API_BASE_URL);
console.log('SOCKET_URL:', SOCKET_URL);

// Configuration d'Axios avec l'URL de base
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// Intercepteur pour les erreurs
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('Erreur API:', error);
    return Promise.reject(error);
  }
);

// Options pour Socket.IO
const socketOptions = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
  withCredentials: true
};

// Création de la connexion socket
const socket = io(SOCKET_URL, socketOptions);

// Gestion des événements socket
socket.on('connect', () => {
  console.log('Connecté au serveur Socket.IO');
});

socket.on('connect_error', (error) => {
  console.error('Erreur de connexion socket:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Déconnecté du serveur Socket.IO:', reason);
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnecté au serveur Socket.IO après ${attemptNumber} tentatives`);
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`Tentative de reconnexion #${attemptNumber}`);
});

socket.on('error', (error) => {
  console.error('Erreur socket:', error);
});

// API pour les tokens
const tokenApi = {
  /**
   * Récupère tous les tokens
   * @returns {Promise} Une promesse avec les données des tokens
   */
  getTokens() {
    return apiClient.get('/tokens');
  },

  /**
   * Récupère un token par son ID
   * @param {string} id - L'ID du token
   * @returns {Promise} Une promesse avec les données du token
   */
  getToken(id) {
    return apiClient.get(`/tokens/${id}`);
  }
};

// API pour la santé du serveur
const healthApi = {
  /**
   * Vérifie l'état du serveur
   * @returns {Promise} Une promesse avec les informations sur l'état du serveur
   */
  check() {
    return apiClient.get('/health');
  }
};

// Exporter les services API et socket
export { 
  apiClient,
  socket,
  tokenApi,
  healthApi
}; 