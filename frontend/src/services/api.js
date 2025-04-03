import axios from 'axios';
import io from 'socket.io-client';

// Configuration des URLs d'API et de Socket
// Pour le déploiement:
// 1. Ces URLs sont configurées pour utiliser l'adresse IP 185.97.146.99
// 2. Le backend fonctionne sur le port 6607
// 3. Le frontend fonctionne sur le port 6608

// URL de base pour l'API - Environnement de production vs développement
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'http://185.97.146.99:6607/api'  // URL de production
  : 'http://localhost:6607/api';     // URL de développement

// URL pour les connexions Socket.io
const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? 'http://185.97.146.99:6607'      // URL de production
  : 'http://localhost:6607';         // URL de développement

// Configuration d'Axios avec l'URL de base
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Création de la connexion socket
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

// Événements socket
socket.on('connect', () => {
  console.log('Connecté au serveur Socket.IO');
});

socket.on('disconnect', () => {
  console.log('Déconnecté du serveur Socket.IO');
});

socket.on('connect_error', (error) => {
  console.error('Erreur de connexion Socket.IO:', error);
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