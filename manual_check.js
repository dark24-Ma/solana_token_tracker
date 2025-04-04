const io = require('socket.io-client');

// Connecter au serveur Socket.IO
const socket = io('http://185.97.146.99:6608');

// Écouter les événements
socket.on('connect', () => {
  console.log('Connecté au serveur');
  
  // Demander le statut du système
  socket.emit('getSystemStatus');
  
  // Démarrer la surveillance des tokens
  console.log('Démarrage de la surveillance des tokens...');
  socket.emit('startWatching');
  
  // Attendre 5 secondes avant de déclencher une vérification manuelle
  setTimeout(() => {
    console.log('Déclenchement de la vérification manuelle de Solscan...');
    socket.emit('checkSolscan');
  }, 5000);
});

socket.on('systemStatus', (status) => {
  console.log('Statut du système:', JSON.stringify(status, null, 2));
});

socket.on('systemLog', (log) => {
  console.log(`[${log.type}] ${log.message}`);
});

socket.on('newToken', (token) => {
  console.log('Nouveau token détecté:', token.name, token.symbol, token.mint);
});

// Écouter spécifiquement les memecoins
socket.on('newMemecoin', (token) => {
  console.log('🔥 NOUVEAU MEMECOIN DÉTECTÉ 🔥', token.name, token.symbol, token.mint);
  console.log('Détails:', JSON.stringify({
    adresse: token.mint,
    nom: token.name,
    symbole: token.symbol,
    prix: token.price,
    supply: token.totalSupply
  }, null, 2));
});

// Garder le script en vie pendant 60 secondes
setTimeout(() => {
  console.log('Fermeture de la connexion...');
  socket.close();
  process.exit(0);
}, 60000); 