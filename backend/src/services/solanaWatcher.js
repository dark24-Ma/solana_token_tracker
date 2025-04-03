const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const Token = require('../models/Token');

class SolanaWatcher {
  constructor(connection, io, solanaService) {
    this.connection = connection;
    this.io = io;
    this.solanaService = solanaService;
    this.subscriptionId = null;
    this.isWatching = false;
    this.processedMints = new Set();
    this.checkInterval = null;
    this.lastSignature = null;
  }

  async startWatching() {
    try {
      if (this.isWatching) return;
      this.isWatching = true;
      
      console.log('Initialisation de la recherche de tokens récents...');
      // Récupérer quelques tokens récents pour initialiser
      const recentTokens = await this.solanaService.getRecentTokens(5);
      console.log(`${recentTokens.length} tokens récents récupérés pour l'initialisation`);
      
      // Ajouter les mints traités à notre ensemble
      recentTokens.forEach(token => {
        this.processedMints.add(token.mint);
      });
      
      // Récupérer la dernière signature pour commencer le suivi à partir de là
      const signatures = await this.connection.getSignaturesForAddress(
        TOKEN_PROGRAM_ID,
        { limit: 1 }
      );
      
      if (signatures && signatures.length > 0) {
        this.lastSignature = signatures[0].signature;
        console.log(`Dernière signature: ${this.lastSignature}`);
      }
      
      // Vérifier les nouvelles transactions toutes les 30 secondes
      this.checkInterval = setInterval(() => this.checkNewTokens(), 30000);
      
      console.log('Surveillance des nouveaux tokens démarrée');
    } catch (error) {
      this.isWatching = false;
      console.error('Erreur lors du démarrage de la surveillance:', error);
    }
  }
  
  async checkNewTokens() {
    try {
      if (!this.isWatching) return;
      console.log('Vérification des nouveaux tokens...');
      
      // Récupérer les signatures plus récentes que la dernière connue
      const signatures = await this.connection.getSignaturesForAddress(
        TOKEN_PROGRAM_ID,
        { 
          until: this.lastSignature,
          limit: 50
        }
      );
