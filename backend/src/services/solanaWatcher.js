const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const Token = require('../models/Token');
const axios = require('axios');

class SolanaWatcher {
  constructor(connection, io, solanaService) {
    this.connection = connection;
    this.io = io;
    this.solanaService = solanaService;
    this.isWatching = false;
    this.watchInterval = null;
    this.solscanWatchInterval = null;
    this.lastCheckedTimestamp = Date.now();
    this.lastSolscanTimestamp = Date.now();
    this.processedTokenAddresses = new Set();
    this.checkFrequency = 30000; // Vérifier toutes les 30 secondes
    this.solscanCheckFrequency = 20000; // Vérifier Solscan toutes les 20 secondes
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  startWatching() {
    if (this.isWatching) {
      console.log('La surveillance est déjà en cours');
      return;
    }

    console.log('Démarrage de la surveillance des tokens Solana...');
    this.isWatching = true;

    // Initialiser le Set des adresses de tokens déjà traités
    this.initializeProcessedTokens();

    // Lancer la surveillance via Solscan
    this.startSolscanWatcher();

    // Lancer la surveillance via l'API Solana
    this.watchInterval = setInterval(() => {
      this.checkNewTokens().catch(error => {
        console.error('Erreur lors de la vérification des nouveaux tokens:', error);
        this.io.emit('error', 'Erreur lors de la vérification des nouveaux tokens');
      });
    }, this.checkFrequency);
  }

  async initializeProcessedTokens() {
    try {
      // Récupérer tous les tokens existants dans la base de données
      const existingTokens = await Token.find({}, 'mint');
      existingTokens.forEach(token => {
        this.processedTokenAddresses.add(token.mint);
      });
      console.log(`${this.processedTokenAddresses.size} tokens existants chargés en mémoire`);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des tokens traités:', error);
    }
  }

  stopWatching() {
    console.log('Arrêt de la surveillance des tokens');
    this.isWatching = false;
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    if (this.solscanWatchInterval) {
      clearInterval(this.solscanWatchInterval);
      this.solscanWatchInterval = null;
    }
  }

  startSolscanWatcher() {
    console.log('Démarrage de la surveillance via Solscan...');
    this.solscanWatchInterval = setInterval(() => {
      this.checkSolscanNewTokens().catch(error => {
        console.error('Erreur lors de la vérification des nouveaux tokens sur Solscan:', error);
      });
    }, this.solscanCheckFrequency);
  }

  async checkSolscanNewTokens() {
    try {
      // Ne pas vérifier sur Solscan si on est en mode cooldown
      if (this.solanaService.solscanCooldownActive) {
        console.log('Solscan est en mode cooldown, vérification ignorée');
        return;
      }
      
      console.log('Vérification des nouveaux tokens sur Solscan...');
      
      // Récupérer les tokens récemment créés depuis l'API Solscan
      const response = await this.solanaService.enqueueApiRequest('https://api.solscan.io/token/list?sortBy=createTime&direction=desc&limit=20&offset=0');

      if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
        console.log('Réponse invalide de Solscan:', response.data);
        return;
      }

      const recentTokens = response.data.data;
      console.log(`${recentTokens.length} tokens récents trouvés sur Solscan`);

      // Vérifier si des nouveaux tokens ont été listés depuis la dernière vérification
      const newTokenPromises = [];
      
      for (const tokenData of recentTokens) {
        // Vérifier si le token existe déjà dans notre base
        if (tokenData.address && !this.processedTokenAddresses.has(tokenData.address)) {
          newTokenPromises.push(this.processSolscanToken(tokenData));
        }
      }

      if (newTokenPromises.length > 0) {
        console.log(`${newTokenPromises.length} nouveaux tokens à traiter de Solscan`);
        await Promise.allSettled(newTokenPromises);
      } else {
        console.log('Aucun nouveau token trouvé sur Solscan');
      }

      this.lastSolscanTimestamp = Date.now();
    } catch (error) {
      console.error('Erreur lors de la vérification sur Solscan:', error.message);
      
      // Si l'erreur est un 403 ou 429, informer les clients
      if (error.response && (error.response.status === 403 || error.response.status === 429)) {
        this.io.emit('systemLog', {
          type: 'warning',
          message: `Accès temporairement limité à Solscan (${error.response.status}). Utilisation de sources alternatives.`
        });
        
        // Nous continuerons à surveiller via l'API Solana même si Solscan est indisponible
        console.log('Continuons la surveillance via l\'API Solana');
      }
    }
  }

  async processSolscanToken(tokenData) {
    try {
      const tokenAddress = tokenData.address;
      if (!tokenAddress || this.processedTokenAddresses.has(tokenAddress)) {
        return null;
      }

      // Marquer le token comme traité
      this.processedTokenAddresses.add(tokenAddress);

      // Vérifier que l'adresse est valide
      try {
        new PublicKey(tokenAddress);
      } catch (error) {
        console.log(`Adresse de token invalide: ${tokenAddress}`);
        return null;
      }

      // Récupérer les informations complètes du token
      const tokenInfo = await this.solanaService.getTokenInfo(tokenAddress);
      
      // Ne sauvegarder que les tokens avec des informations valides
      if (!tokenInfo.name || !tokenInfo.symbol) {
        console.log(`Token sans nom ou symbole ignoré: ${tokenAddress}`);
        return null;
      }

      // Préparation des données pour le token
      const tokenToSave = {
        address: tokenInfo.address,
        mint: tokenInfo.mint,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        totalSupply: tokenInfo.totalSupply,
        price: tokenInfo.price,
        volume24h: tokenInfo.volume24h,
        marketCap: tokenInfo.marketCap,
        logoURI: tokenInfo.logoURI || tokenData.logoURI
      };

      // Sauvegarder dans la base de données
      let token = await Token.findOne({ mint: tokenAddress });
      
      if (token) {
        // Mettre à jour le token existant
        Object.assign(token, tokenToSave);
        token.lastUpdated = new Date();
        await token.save();
        console.log(`Token mis à jour: ${tokenInfo.name} (${tokenInfo.symbol})`);
      } else {
        // Créer un nouveau token
        token = new Token(tokenToSave);
        await token.save();
        console.log(`Nouveau token ajouté: ${tokenInfo.name} (${tokenInfo.symbol})`);
        
        // Émettre l'événement pour les clients
        this.io.emit('newToken', token);
      }

      return token;
    } catch (error) {
      console.error(`Erreur lors du traitement du token Solscan ${tokenData.address}:`, error.message);
      return null;
    }
  }

  async checkNewTokens() {
    try {
      if (!this.isWatching) {
        return;
      }

      console.log('Vérification des nouveaux tokens via l\'API Solana...');
      const now = Date.now();
      const timeSinceLastCheck = now - this.lastCheckedTimestamp;
      
      // Récupérer les tokens récents
      const recentTokens = await this.solanaService.getRecentTokens(20);
      
      if (!recentTokens || recentTokens.length === 0) {
        console.log('Aucun token récent trouvé via l\'API Solana');
        this.lastCheckedTimestamp = now;
        return;
      }
      
      console.log(`${recentTokens.length} tokens récents trouvés via l'API Solana`);
      
      // Traiter chaque token
      const processPromises = recentTokens.map(tokenInfo => this.processToken(tokenInfo));
      await Promise.allSettled(processPromises);
      
      this.lastCheckedTimestamp = now;
    } catch (error) {
      console.error('Erreur lors de la vérification des nouveaux tokens:', error);
    }
  }

  async processToken(tokenInfo) {
    try {
      if (!tokenInfo.mint || this.processedTokenAddresses.has(tokenInfo.mint)) {
        return;
      }
      
      // Vérifier que l'adresse est valide
      try {
        new PublicKey(tokenInfo.mint);
      } catch (error) {
        console.log(`Adresse de token invalide: ${tokenInfo.mint}`);
        return;
      }
      
      // Ne traiter que les tokens avec nom et symbole
      if (!tokenInfo.name || !tokenInfo.symbol) {
        console.log(`Token sans nom ou symbole ignoré: ${tokenInfo.mint}`);
        return;
      }
      
      // Ajouter à l'ensemble des tokens traités
      this.processedTokenAddresses.add(tokenInfo.mint);
      
      // Vérifier si le token existe déjà en BDD
      let token = await Token.findOne({ mint: tokenInfo.mint });
      
      if (!token) {
        // Créer un nouveau token
        token = new Token(tokenInfo);
        await token.save();
        console.log(`Nouveau token ajouté via API Solana: ${tokenInfo.name} (${tokenInfo.symbol})`);
        
        // Émettre l'événement pour les clients
        this.io.emit('newToken', token);
      }
    } catch (error) {
      console.error(`Erreur lors du traitement du token ${tokenInfo.mint}:`, error);
    }
  }

  // Ajouter une méthode pour permettre la vérification manuelle par les utilisateurs
  async checkManually() {
    console.log('Vérification manuelle des nouveaux tokens demandée...');
    
    try {
      // Essayer d'abord via Solscan si pas en cooldown
      if (!this.solanaService.solscanCooldownActive) {
        try {
          await this.checkSolscanNewTokens();
          // Si la vérification Solscan a réussi, informer les clients
          this.io.emit('systemLog', {
            type: 'success',
            message: 'Vérification manuelle Solscan terminée avec succès'
          });
        } catch (solscanError) {
          console.error('Échec de la vérification Solscan manuelle:', solscanError.message);
          
          // Si l'erreur est un 403 ou 429, tenter via l'API Solana
          if (solscanError.response && (solscanError.response.status === 403 || solscanError.response.status === 429)) {
            this.io.emit('systemLog', {
              type: 'warning',
              message: `Accès limité à Solscan (${solscanError.response.status}). Utilisation de l'API Solana.`
            });
            
            await this.checkNewTokens();
          } else {
            throw solscanError;
          }
        }
      } else {
        // Si Solscan est en cooldown, utiliser directement l'API Solana
        this.io.emit('systemLog', {
          type: 'info',
          message: 'Solscan est en mode cooldown. Vérification via l\'API Solana uniquement.'
        });
        
        await this.checkNewTokens();
      }
      
      this.io.emit('systemLog', {
        type: 'success',
        message: 'Vérification manuelle des tokens terminée'
      });
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification manuelle:', error.message);
      
      this.io.emit('systemLog', {
        type: 'error',
        message: `Erreur lors de la vérification manuelle: ${error.message}`
      });
      
      return false;
    }
  }
}

module.exports = SolanaWatcher; 