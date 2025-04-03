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

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/solana_tracker')
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Configuration Solana
console.log("Connexion au réseau Solana mainnet...");
const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const solanaConnection = new Connection(solanaRpcUrl, 'confirmed');
console.log(`Connecté au point de terminaison RPC Solana: ${solanaRpcUrl}`);

// Initialiser le service Solana
const solanaService = new SolanaService(solanaConnection);

// Initialiser et démarrer la surveillance des nouveaux tokens
const solanaWatcher = new SolanaWatcher(solanaConnection, io, solanaService);

// Démarrer la surveillance une fois la connexion à la base de données établie
mongoose.connection.on