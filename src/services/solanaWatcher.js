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
    this.explorerWatchInterval = null;
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
    
    // Lancer la surveillance via l'explorateur Solana
    this.startSolanaExplorerWatcher();
    
    // Lancer la surveillance via DexScreener (pour les tokens récemment listés)
    this.startDexScreenerWatcher();

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
    if (this.explorerWatchInterval) {
      clearInterval(this.explorerWatchInterval);
      this.explorerWatchInterval = null;
    }
    if (this.dexScreenerWatchInterval) {
      clearInterval(this.dexScreenerWatchInterval);
      this.dexScreenerWatchInterval = null;
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

      // Vérifier si c'est un memecoin potentiel
      const isMemeToken = this.isMemeToken(tokenInfo);
      if (isMemeToken) {
        console.log(`Potentiel MEMECOIN détecté: ${tokenInfo.name} (${tokenInfo.symbol})`);
        tokenInfo.isMemecoin = true;
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
        logoURI: tokenInfo.logoURI || tokenData.logoURI,
        isMemecoin: tokenInfo.isMemecoin || false,
        tokenType: tokenInfo.isMemecoin ? 'memecoin' : 'standard'
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
        
        // Émettre un événement spécial pour les memecoins
        if (token.isMemecoin) {
          this.io.emit('newMemecoin', token);
        }
      }

      return token;
    } catch (error) {
      console.error(`Erreur lors du traitement du token Solscan ${tokenData.address}:`, error.message);
      return null;
    }
  }

  // Méthode pour identifier les memecoins potentiels
  isMemeToken(tokenInfo) {
    if (!tokenInfo.name || !tokenInfo.symbol) return false;
    
    // Liste de mots-clés associés aux memecoins
    const memecoinKeywords = [
      'doge', 'shib', 'pepe', 'cat', 'inu', 'moon', 'wojak', 'meme', 
      'rocket', 'lambo', 'ape', 'frog', 'chad', 'pump', 'dump', 'elon', 
      'safe', 'diamond', 'hands', 'tendies', 'wojak', 'degen', 'gme', 
      'amc', 'apes', 'bulls', 'bears', 'kek', 'fomo', 'hodl', 'bonk'
    ];
    
    // Convertir en minuscules pour une recherche insensible à la casse
    const nameLower = tokenInfo.name.toLowerCase();
    const symbolLower = tokenInfo.symbol.toLowerCase();
    
    // Vérifier si l'un des mots-clés est présent dans le nom ou le symbole
    const hasKeyword = memecoinKeywords.some(keyword => 
      nameLower.includes(keyword) || symbolLower.includes(keyword)
    );
    
    // Vérifier les caractéristiques typiques des memecoins
    const hasLargeSupply = tokenInfo.totalSupply > 1000000000; // Supply élevée
    const hasLowPrice = tokenInfo.price < 0.01; // Prix unitaire faible
    
    // Un token est considéré comme un memecoin s'il contient un mot-clé
    // ou s'il a à la fois un large supply et un prix bas
    return hasKeyword || (hasLargeSupply && hasLowPrice);
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
      
      // Vérifier si c'est un memecoin potentiel
      const isMemeToken = this.isMemeToken(tokenInfo);
      if (isMemeToken) {
        console.log(`Potentiel MEMECOIN détecté: ${tokenInfo.name} (${tokenInfo.symbol})`);
        tokenInfo.isMemecoin = true;
        tokenInfo.tokenType = 'memecoin';
      } else {
        tokenInfo.isMemecoin = false;
        tokenInfo.tokenType = 'standard';
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
        
        // Émettre un événement spécial pour les memecoins
        if (token.isMemecoin) {
          this.io.emit('newMemecoin', token);
        }
      }
    } catch (error) {
      console.error(`Erreur lors du traitement du token ${tokenInfo.mint}:`, error);
    }
  }

  // Méthode pour vérifier manuellement les nouveaux tokens
  async checkManually() {
    console.log("Vérification manuelle des nouveaux tokens demandée...");
    this.io.emit('systemLog', { type: 'info', message: 'Vérification manuelle des tokens initiée' });

    try {
      // Vérifier DexScreener en premier (source principale)
      await this.checkDexScreenerTokens();
      this.io.emit('systemLog', { type: 'success', message: 'Vérification DexScreener terminée avec succès' });
      
      // Vérifier Solscan
      await this.checkSolscanNewTokens();
      this.io.emit('systemLog', { type: 'success', message: 'Vérification Solscan terminée avec succès' });
      
      // Vérifier l'explorateur Solana
      await this.checkSolanaExplorerTokens();
      this.io.emit('systemLog', { type: 'success', message: 'Vérification explorateur Solana terminée avec succès' });
      
      // Vérifier également via l'API Solana
      await this.checkNewTokens();
      this.io.emit('systemLog', { type: 'success', message: 'Vérification manuelle des tokens terminée' });
      
      return true;
    } catch (error) {
      console.error("Erreur lors de la vérification manuelle:", error);
      this.io.emit('systemLog', { type: 'error', message: `Erreur lors de la vérification: ${error.message}` });
      return false;
    }
  }

  startSolanaExplorerWatcher() {
    console.log('Démarrage de la surveillance des memecoins via l\'explorateur Solana...');
    
    // Système de fréquence adaptative - plus rapide pour les surveillances initiales
    const checkFrequencies = [5000, 10000, 15000];
    let freqIndex = 0;
    
    const checkForMemecoins = async () => {
      try {
        await this.checkSolanaExplorerTokens();
        
        // Incrémenter l'index de fréquence pour ralentir progressivement les vérifications
        // mais ne pas dépasser la taille du tableau
        if (freqIndex < checkFrequencies.length - 1) {
          freqIndex++;
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des nouveaux tokens:', error);
      }
    };
    
    // Vérification immédiate au démarrage
    checkForMemecoins();
    
    // Ensuite, planifier les vérifications avec une fréquence adaptative
    this.explorerWatchInterval = setInterval(() => {
      // Mise à jour de l'intervalle en fonction du temps écoulé
      clearInterval(this.explorerWatchInterval);
      
      // Exécuter la vérification
      checkForMemecoins();
      
      // Redémarrer avec la nouvelle fréquence
      this.explorerWatchInterval = setInterval(checkForMemecoins, checkFrequencies[freqIndex]);
      
    }, checkFrequencies[0]); // Commencer avec la fréquence la plus rapide
    
    console.log(`Surveillance des memecoins active avec une fréquence initiale de ${checkFrequencies[0]/1000}s`);
  }
  
  async checkSolanaExplorerTokens() {
    try {
      console.log('Vérification des nouveaux tokens via l\'explorateur Solana...');
      
      // Explorer API pour les transactions Token Program récentes
      const response = await this.solanaService.enqueueApiRequest(
        'https://api.solscan.io/v2/transaction/last?tokenAddress=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA&limit=20',
        3
      );
      
      if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
        console.log('Réponse invalide de l\'explorateur Solana');
        return;
      }
      
      const transactions = response.data.data;
      console.log(`${transactions.length} transactions récentes du Token Program trouvées`);
      
      // Analyser les transactions pour trouver de nouveaux tokens
      const mintPromises = [];
      for (const tx of transactions) {
        if (tx.tokenBalances && tx.tokenBalances.length > 0) {
          // Extraire les adresses de nouveaux tokens (mints)
          for (const tokenBalance of tx.tokenBalances) {
            if (tokenBalance.mint && !this.processedTokenAddresses.has(tokenBalance.mint)) {
              console.log(`Nouveau token potentiel trouvé: ${tokenBalance.mint}`);
              mintPromises.push(this.processMintFromExplorer(tokenBalance.mint));
            }
          }
        }
      }
      
      if (mintPromises.length > 0) {
        console.log(`${mintPromises.length} nouveaux tokens potentiels à traiter de l'explorateur`);
        await Promise.allSettled(mintPromises);
      } else {
        console.log('Aucun nouveau token trouvé sur l\'explorateur Solana');
      }
    } catch (error) {
      console.error('Erreur lors de la vérification sur l\'explorateur Solana:', error.message);
    }
  }
  
  async processMintFromExplorer(mintAddress) {
    try {
      // Vérifier si l'adresse est déjà traitée
      if (this.processedTokenAddresses.has(mintAddress)) {
        return null;
      }
      
      // Marquer comme traitée
      this.processedTokenAddresses.add(mintAddress);
      
      console.log(`Traitement du nouveau token: ${mintAddress}`);
      
      // Récupérer les informations depuis DexScreener d'abord (si disponible)
      const dexScreenerInfo = await this.solanaService.getTokenInfoFromDexScreener(mintAddress);
      
      // Si DexScreener ne trouve pas d'informations, utiliser notre service habituel
      let tokenInfo;
      if (dexScreenerInfo) {
        tokenInfo = {
          mint: mintAddress,
          address: mintAddress,
          name: dexScreenerInfo.name,
          symbol: dexScreenerInfo.symbol,
          price: dexScreenerInfo.priceUsd,
          priceUsd: dexScreenerInfo.priceUsd,
          priceChange24h: dexScreenerInfo.priceChange24h,
          volume24h: dexScreenerInfo.volume24h,
          liquidity: dexScreenerInfo.liquidity,
          fdv: dexScreenerInfo.fdv,
          pairAddress: dexScreenerInfo.pairAddress,
          exchange: dexScreenerInfo.exchange
        };
        
        // Récupérer les métadonnées supplémentaires comme les décimales
        const solanaTokenInfo = await this.solanaService.getTokenInfo(mintAddress);
        if (solanaTokenInfo) {
          tokenInfo.decimals = solanaTokenInfo.decimals;
          tokenInfo.totalSupply = solanaTokenInfo.totalSupply;
        }
      } else {
        // Si DexScreener ne trouve rien, utiliser notre service habituel
        tokenInfo = await this.solanaService.getTokenInfo(mintAddress);
      }
      
      // Ne pas continuer si les informations essentielles manquent
      if (!tokenInfo || !tokenInfo.name || !tokenInfo.symbol) {
        console.log(`Impossible de récupérer les informations pour le token: ${mintAddress}`);
        return null;
      }
      
      // Vérifier si c'est un memecoin
      const isMemeToken = this.isMemeToken(tokenInfo);
      if (isMemeToken) {
        console.log(`🚀 NOUVEAU MEMECOIN détecté via explorateur: ${tokenInfo.name} (${tokenInfo.symbol})`);
        tokenInfo.isMemecoin = true;
        tokenInfo.tokenType = 'memecoin';
        
        // Récupérer l'image du token
        if (!tokenInfo.logoURI) {
          tokenInfo.logoURI = await this.solanaService.tryGetTokenImage(mintAddress);
        }
        
        // Créer ou mettre à jour en BDD
        let token = await Token.findOne({ mint: mintAddress });
        
        if (token) {
          // Mettre à jour
          Object.assign(token, tokenInfo);
          token.lastUpdated = new Date();
          await token.save();
          console.log(`Memecoin mis à jour: ${tokenInfo.name} (${tokenInfo.symbol})`);
        } else {
          // Créer
          token = new Token(tokenInfo);
          await token.save();
          console.log(`Nouveau memecoin ajouté via explorateur: ${tokenInfo.name} (${tokenInfo.symbol})`);
          
          // Notifier tous les clients
          this.io.emit('newToken', token);
          
          // Notifier spécifiquement pour les memecoins
          this.io.emit('newMemecoin', token);
        }
        
        return token;
      } else {
        // Si ce n'est pas un memecoin, on ne le traite que s'il a une paire de trading active
        if (dexScreenerInfo && dexScreenerInfo.liquidity > 0) {
          console.log(`Token standard avec liquidité détecté: ${tokenInfo.name} (${tokenInfo.symbol})`);
          
          tokenInfo.isMemecoin = false;
          tokenInfo.tokenType = 'standard';
          
          let token = await Token.findOne({ mint: mintAddress });
          
          if (token) {
            // Mise à jour mineure
            token.price = tokenInfo.price;
            token.priceUsd = tokenInfo.priceUsd;
            token.volume24h = tokenInfo.volume24h;
            token.liquidity = tokenInfo.liquidity;
            token.lastUpdated = new Date();
            await token.save();
          } else {
            // Créer
            token = new Token(tokenInfo);
            await token.save();
            this.io.emit('newToken', token);
          }
          
          return token;
        } else {
          console.log(`Token non-memecoin sans liquidité ignoré: ${tokenInfo.name} (${tokenInfo.symbol})`);
          return null;
        }
      }
    } catch (error) {
      console.error(`Erreur lors du traitement du token ${mintAddress}:`, error.message);
      return null;
    }
  }

  startDexScreenerWatcher() {
    console.log('Démarrage de la surveillance des memecoins via DexScreener...');
    
    // Vérifier toutes les 60 secondes (pour éviter d'être rate-limité)
    const checkInterval = 60000;
    
    // Première vérification immédiate
    this.checkDexScreenerTokens().catch(error => {
      console.error('Erreur lors de la vérification initiale sur DexScreener:', error);
    });
    
    // Puis régulièrement
    this.dexScreenerWatchInterval = setInterval(() => {
      this.checkDexScreenerTokens().catch(error => {
        console.error('Erreur lors de la vérification des tokens sur DexScreener:', error);
      });
    }, checkInterval);
    
    console.log(`Surveillance DexScreener active avec une fréquence de ${checkInterval/1000}s`);
  }
  
  async checkDexScreenerTokens() {
    try {
      console.log('Vérification des nouveaux tokens via DexScreener...');
      
      // Récupérer les tokens récents via DexScreener
      const recentTokens = await this.solanaService.getRecentTokensFromDexScreener(50);
      
      if (!recentTokens || recentTokens.length === 0) {
        console.log('Aucun token récent trouvé sur DexScreener');
        return;
      }
      
      console.log(`${recentTokens.length} tokens récents trouvés sur DexScreener`);
      
      // Traiter chaque token
      const newTokenPromises = [];
      
      for (const tokenInfo of recentTokens) {
        // Vérifier si le token existe déjà dans notre base
        if (tokenInfo.mint && !this.processedTokenAddresses.has(tokenInfo.mint)) {
          newTokenPromises.push(this.processDexScreenerToken(tokenInfo));
        }
      }
      
      if (newTokenPromises.length > 0) {
        console.log(`${newTokenPromises.length} nouveaux tokens à traiter de DexScreener`);
        await Promise.allSettled(newTokenPromises);
      } else {
        console.log('Aucun nouveau token trouvé sur DexScreener');
      }
    } catch (error) {
      console.error('Erreur lors de la vérification sur DexScreener:', error.message);
    }
  }
  
  async processDexScreenerToken(tokenInfo) {
    try {
      if (!tokenInfo.mint || this.processedTokenAddresses.has(tokenInfo.mint)) {
        return null;
      }
      
      // Marquer le token comme traité
      this.processedTokenAddresses.add(tokenInfo.mint);
      
      console.log(`Traitement du token DexScreener: ${tokenInfo.name} (${tokenInfo.symbol})`);
      
      // Récupérer les métadonnées supplémentaires
      try {
        const solanaTokenInfo = await this.solanaService.getTokenInfo(tokenInfo.mint);
        if (solanaTokenInfo && solanaTokenInfo.decimals) {
          tokenInfo.decimals = solanaTokenInfo.decimals;
          tokenInfo.totalSupply = solanaTokenInfo.totalSupply;
        } else {
          // Par défaut pour les SPL Tokens
          tokenInfo.decimals = 9;
        }
      } catch (e) {
        console.log(`Impossible de récupérer les métadonnées pour: ${tokenInfo.mint}`);
        tokenInfo.decimals = 9; // Valeur par défaut
      }
      
      // Vérifier si c'est un memecoin
      const isMemeToken = this.isMemeToken(tokenInfo);
      tokenInfo.isMemecoin = isMemeToken;
      tokenInfo.tokenType = isMemeToken ? 'memecoin' : 'standard';
      
      // Pour les memecoins, récupérer l'image
      if (isMemeToken && !tokenInfo.logoURI) {
        try {
          tokenInfo.logoURI = await this.solanaService.tryGetTokenImage(tokenInfo.mint);
        } catch (e) {
          console.log(`Impossible de récupérer l'image pour: ${tokenInfo.mint}`);
        }
      }
      
      if (isMemeToken) {
        console.log(`🚀 NOUVEAU MEMECOIN détecté via DexScreener: ${tokenInfo.name} (${tokenInfo.symbol})`);
      }
      
      // Créer ou mettre à jour en BDD
      let token = await Token.findOne({ mint: tokenInfo.mint });
      
      if (token) {
        // Mettre à jour
        Object.assign(token, tokenInfo);
        token.lastUpdated = new Date();
        await token.save();
        console.log(`Token mis à jour via DexScreener: ${tokenInfo.name} (${tokenInfo.symbol})`);
      } else {
        // Créer
        token = new Token(tokenInfo);
        await token.save();
        console.log(`Nouveau token ajouté via DexScreener: ${tokenInfo.name} (${tokenInfo.symbol})`);
        
        // Notifier tous les clients
        this.io.emit('newToken', token);
        
        // Notifier spécifiquement pour les memecoins
        if (isMemeToken) {
          this.io.emit('newMemecoin', token);
        }
      }
      
      return token;
    } catch (error) {
      console.error(`Erreur lors du traitement du token DexScreener ${tokenInfo.mint}:`, error.message);
      return null;
    }
  }
}

module.exports = SolanaWatcher; 