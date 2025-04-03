const express = require('express');
const router = express.Router();
const TokenController = require('../controllers/tokenController');
const SolanaService = require('../services/solanaService');
const { Connection } = require('@solana/web3.js');

// Initialisation des services
const solanaConnection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
const solanaService = new SolanaService(solanaConnection);
const tokenController = new TokenController(solanaService);

// Routes pour les tokens
router.get('/', tokenController.getAllTokens.bind(tokenController));
router.get('/:address', tokenController.getTokenByAddress.bind(tokenController));
router.post('/', tokenController.addToken.bind(tokenController));
router.put('/:address', tokenController.updateToken.bind(tokenController));
router.delete('/:address', tokenController.deleteToken.bind(tokenController));

module.exports = router; 