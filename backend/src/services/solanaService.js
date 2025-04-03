const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const axios = require('axios');
const Token = require('../models/Token');

class SolanaService {
  constructor(connection) {
    this.connection = connection;
  }

  async getTokenInfo(tokenAddress) {
    try {
      const tokenPubkey = new PublicKey(tokenAddress);
      
      // Récupérer les métadonnées du token
      let tokenMetadata = {};
      try {
        // Essayer de récupérer les métadonnées depuis Solscan
        const solscanResponse = await axios.get(`https://api.solscan.io/token/meta?token=${tokenAddress}`);
        if (solscanResponse.data && solscanResponse.data.success) {
          const metadata = solscanResponse.data.data;
          tokenMetadata = {
            name: metadata.name || 'Unknown Token',
            symbol: metadata.symbol || 'UNKNOWN',
            logoURI: metadata.icon || null
          };
        }
      } catch (metadataError) {
        console.log('Impossible de récupérer les métadonnées depuis Solscan', metadataError.message);
        // Si les métadonnées ne sont pas disponibles, utiliser des valeurs par défaut
        tokenMetadata = {
          name: `Token ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`,
          symbol: `TKN${tokenAddress.slice(0, 3).toUpperCase()}`,
          logoURI: null
     