const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const axios = require('axios');
const Token = require('../models/Token');

class SolanaService {
  constructor(connection) {
    this.connection = connection;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.apiCallsCount = 0;
    this.lastResetTime = Date.now();
    this.MAX_CALLS_PER_MINUTE = 10; // Réduit pour éviter les erreurs 403/429
    
    // Sources d'images supplémentaires pour les tokens Solana
    this.tokenImageSources = [
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet',
      'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/assets/mainnet'
    ];
    
    // Fallback pour les RPC Solana
    this.fallbackEndpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana'
    ];
    this.currentEndpointIndex = 0;
    
    // Rotation de User-Agents pour éviter les blocages
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.2557.58 Mobile/15E148 Safari/604.1'
    ];
    
    // Index courant pour la rotation des User-Agents
    this.currentUserAgentIndex = 0;
    
    // Dernière utilisation de Solscan
    this.lastSolscanRequestTime = 0;
    this.consecutiveSolscanErrors = 0;
    this.solscanCooldownActive = false;
  }
  
  // Obtenir le prochain User-Agent dans la rotation
  getNextUserAgent() {
    const userAgent = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return userAgent;
  }

  // Ajouter un délai entre les requêtes
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // File d'attente pour les requêtes API
  async enqueueApiRequest(url, retries = 3) {
    return new Promise((resolve, reject) => {
      const request = { 
        url, 
        resolve, 
        reject, 
        retries 
      };
      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    // Réinitialiser le compteur d'appels API toutes les minutes
    const now = Date.now();
    if (now - this.lastResetTime > 60000) {
      this.apiCallsCount = 0;
      this.lastResetTime = now;
    }
    
    // Vérifier si nous avons atteint la limite d'appels
    if (this.apiCallsCount >= this.MAX_CALLS_PER_MINUTE) {
      const waitTime = 60000 - (now - this.lastResetTime) + 5000; // Ajouter 5 secondes de marge
      console.log(`Limite d'API atteinte, attente de ${waitTime}ms avant la prochaine requête`);
      await this.sleep(waitTime);
      this.apiCallsCount = 0;
      this.lastResetTime = Date.now();
    }
    
    const request = this.requestQueue.shift();
    const { url, resolve, reject, retries } = request;
    
    try {
      // Gérer spécifiquement les requêtes Solscan pour éviter les blocages
      const isSolscanRequest = url.includes('solscan.io');
      
      if (isSolscanRequest) {
        // Vérifier si nous sommes en mode cooldown pour Solscan
        if (this.solscanCooldownActive) {
          const cooldownTime = 3600000; // 1 heure de cooldown
          if (now - this.lastSolscanRequestTime < cooldownTime) {
            throw new Error('Solscan est temporairement indisponible (en cooldown)');
          } else {
            this.solscanCooldownActive = false;
            this.consecutiveSolscanErrors = 0;
          }
        }
        
        // S'assurer d'avoir au moins 3 secondes entre les requêtes Solscan
        const timeSinceLastSolscanRequest = now - this.lastSolscanRequestTime;
        if (timeSinceLastSolscanRequest < 3000) {
          await this.sleep(3000 - timeSinceLastSolscanRequest);
        }
        
        this.lastSolscanRequestTime = Date.now();
      } else {
        // Attendre un délai aléatoire entre 800 et 1500ms pour éviter les rafales de requêtes
        await this.sleep(800 + Math.random() * 700);
      }
      
      this.apiCallsCount++;
      
      // Préparer les entêtes avec rotation des User-Agents
      const userAgent = this.getNextUserAgent();
      
      const headers = {
        'User-Agent': userAgent,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      // Ajouter des entêtes spécifiques pour Solscan
      if (isSolscanRequest) {
        headers['Referer'] = 'https://solscan.io/';
        headers['Origin'] = 'https://solscan.io';
        // Ajouter un paramètre aléatoire pour éviter le cache
        const randomParam = `_t=${Date.now()}`;
        url = url.includes('?') ? `${url}&${randomParam}` : `${url}?${randomParam}`;
      }
      
      const response = await axios.get(url, {
        timeout: 15000, // Augmenter le timeout
        headers
      });
      
      // Réinitialiser le compteur d'erreurs Solscan en cas de succès
      if (isSolscanRequest) {
        this.consecutiveSolscanErrors = 0;
      }
      
      resolve(response);
    } catch (error) {
      console.error(`Erreur API: ${url} - ${error.message}`);
      
      const statusCode = error.response?.status;
      const isSolscanRequest = url.includes('solscan.io');
      
      // Gestion spécifique des erreurs Solscan
      if (isSolscanRequest) {
        this.consecutiveSolscanErrors++;
        console.log(`Erreurs consécutives Solscan: ${this.consecutiveSolscanErrors}`);
        
        // Si trop d'erreurs 403/429, mettre Solscan en "cooldown"
        if ((statusCode === 403 || statusCode === 429) && this.consecutiveSolscanErrors >= 3) {
          console.log("Trop d'erreurs Solscan - activation du mode cooldown pour 1 heure");
          this.solscanCooldownActive = true;
          this.lastSolscanRequestTime = Date.now();
          
          // Utiliser une API alternative ou sauter cette étape
          reject(new Error('Solscan temporairement indisponible - trop de requêtes'));
          this.isProcessingQueue = false;
          setTimeout(() => this.processQueue(), 500);
          return;
        }
      }
      
      if (retries > 0) {
        // Attendre plus longtemps entre les tentatives en cas d'erreur
        const backoffTime = 2000 * (3 - retries + 1);
        console.log(`Nouvelle tentative dans ${backoffTime}ms (${retries} restantes) pour: ${url}`);
        
        // Attendre avant de réessayer
        await this.sleep(backoffTime);
        
        this.requestQueue.push({
          url,
          resolve,
          reject,
          retries: retries - 1
        });
      } else {
        reject(error);
      }
    } finally {
      this.isProcessingQueue = false;
      
      // Attendre un peu avant de traiter la requête suivante
      setTimeout(() => this.processQueue(), 500);
    }
  }

  // Obtenir une connexion alternative en cas d'erreur
  getFallbackConnection() {
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.fallbackEndpoints.length;
    const endpoint = this.fallbackEndpoints[this.currentEndpointIndex];
    console.log(`Utilisation du point de terminaison alternatif: ${endpoint}`);
    return new Connection(endpoint, 'confirmed');
  }

  // Tenter de récupérer une image de token à partir de plusieurs sources
  async tryGetTokenImage(mint) {
    // Essayer d'abord Jupiter Aggregator qui a beaucoup d'images de tokens
    try {
      const jupiterResponse = await axios.get(`https://token.jup.ag/all`, { timeout: 5000 });
      const jupiterTokens = jupiterResponse.data;
      
      const token = jupiterTokens.find(t => t.address === mint);
      if (token && token.logoURI) {
        return token.logoURI;
      }
    } catch (error) {
      console.log('Impossible de récupérer l\'image depuis Jupiter:', error.message);
    }
    
    // Essayer Solana token-list
    for (const baseUrl of this.tokenImageSources) {
      try {
        // Format du chemin d'image sur GitHub
        const imageUrl = `${baseUrl}/${mint}/logo.png`;
        
        // Vérifier si l'image existe
        const response = await axios.head(imageUrl, { timeout: 3000 });
        if (response.status === 200) {
          return imageUrl;
        }
      } catch (error) {
        // Ignorer les erreurs et passer à la source suivante
      }
    }
    
    // Essayer Solscan
    try {
      const solscanResponse = await this.enqueueApiRequest(`https://api.solscan.io/token/meta?token=${mint}`);
      if (solscanResponse.data && solscanResponse.data.success && solscanResponse.data.data.icon) {
        return solscanResponse.data.data.icon;
      }
    } catch (error) {
      console.log('Impossible de récupérer l\'image depuis Solscan:', error.message);
    }
    
    // Si toutes les sources échouent, retourner une image par défaut
    return `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png`;
  }

  async getTokenInfo(tokenAddress, useCache = true) {
    try {
      // Vérifier d'abord si le token existe dans la base de données (cache)
      if (useCache) {
        const cachedToken = await Token.findOne({ mint: tokenAddress });
        if (cachedToken) {
          console.log(`Token trouvé en cache: ${tokenAddress}`);
          return cachedToken;
        }
      }

      console.log(`Récupération des informations pour le token: ${tokenAddress}`);
      
      // Valider l'adresse du token
      let tokenPubkey;
      try {
        tokenPubkey = new PublicKey(tokenAddress);
      } catch (pubkeyError) {
        console.error('Adresse de token invalide:', tokenAddress);
        throw new Error('Adresse de token invalide');
      }
      
      // Récupérer les métadonnées du token (nom, symbole)
      let tokenMetadata = { name: null, symbol: null, logoURI: null };
      
      // Essayer d'abord Jupiter qui a beaucoup de données sur les tokens
      try {
        const jupiterResponse = await axios.get(`https://token.jup.ag/all`, { timeout: 5000 });
        const jupiterTokens = jupiterResponse.data;
        
        const token = jupiterTokens.find(t => t.address === tokenAddress);
        if (token) {
          tokenMetadata = {
            name: token.name,
            symbol: token.symbol,
            logoURI: token.logoURI
          };
          console.log(`Métadonnées récupérées depuis Jupiter pour ${tokenAddress}: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
        }
      } catch (jupiterError) {
        console.log('Impossible de récupérer les métadonnées depuis Jupiter:', jupiterError.message);
      }
      
      // Si Jupiter échoue, essayer Solscan
      if (!tokenMetadata.name) {
        try {
          const solscanResponse = await this.enqueueApiRequest(`https://api.solscan.io/token/meta?token=${tokenAddress}`);
          
          if (solscanResponse.data && solscanResponse.data.success) {
            const metadata = solscanResponse.data.data;
            tokenMetadata = {
              name: metadata.name || tokenMetadata.name,
              symbol: metadata.symbol || tokenMetadata.symbol,
              logoURI: metadata.icon || tokenMetadata.logoURI
            };
            console.log(`Métadonnées récupérées depuis Solscan pour ${tokenAddress}: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
          }
        } catch (metadataError) {
          console.log('Impossible de récupérer les métadonnées depuis Solscan:', metadataError.message);
        }
      }
      
      // Si les métadonnées sont toujours vides, essayer avec la connexion RPC
      if (!tokenMetadata.name) {
        try {
          // Récupérer les métadonnées on-chain
          const accountInfo = await this.connection.getAccountInfo(tokenPubkey);
          
          if (accountInfo && accountInfo.data) {
            // Analyser les données du compte
            tokenMetadata = {
              name: `Token ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`,
              symbol: `SOL`,
              logoURI: null
            };
          }
        } catch (chainError) {
          console.log('Impossible de récupérer les métadonnées on-chain:', chainError.message);
        }
      }
      
      // Si on n'a pas trouvé d'image, essayer de trouver spécifiquement une image
      if (!tokenMetadata.logoURI) {
        tokenMetadata.logoURI = await this.tryGetTokenImage(tokenAddress);
      }
      
      // Récupérer les informations de supply
      let supplyInfo = { amount: 0, decimals: 9 };
      try {
        let tokenSupply;
        try {
          tokenSupply = await this.connection.getTokenSupply(tokenPubkey);
        } catch (mainRpcError) {
          console.log('Erreur RPC principale, utilisation du fallback:', mainRpcError.message);
          const fallbackConnection = this.getFallbackConnection();
          tokenSupply = await fallbackConnection.getTokenSupply(tokenPubkey);
        }
        
        if (tokenSupply && tokenSupply.value) {
          supplyInfo = {
            amount: parseFloat(tokenSupply.value.amount) / Math.pow(10, tokenSupply.value.decimals),
            decimals: tokenSupply.value.decimals
          };
          console.log(`Supply récupéré pour ${tokenAddress}: ${supplyInfo.amount} (${supplyInfo.decimals} decimals)`);
        }
      } catch (supplyError) {
        console.log('Impossible de récupérer les informations de supply:', supplyError.message);
      }
      
      // Récupérer les données de marché (prix, volume, market cap)
      let price = 0;
      let volume24h = 0;
      let marketCap = 0;
      
      try {
        // Essayer Coingecko pour les prix
        const tokenSymbol = tokenMetadata.symbol ? tokenMetadata.symbol.toLowerCase() : '';
        const tokenName = tokenMetadata.name ? tokenMetadata.name.toLowerCase() : '';
        
        if (tokenSymbol || tokenName) {
          try {
            const cgSearchResponse = await axios.get(
              `https://api.coingecko.com/api/v3/search?query=${tokenSymbol || tokenName}`,
              { timeout: 5000 }
            );
            
            if (cgSearchResponse.data && cgSearchResponse.data.coins && cgSearchResponse.data.coins.length > 0) {
              const coin = cgSearchResponse.data.coins[0];
              const coinId = coin.id;
              
              const cgPriceResponse = await axios.get(
                `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
                { timeout: 5000 }
              );
              
              if (cgPriceResponse.data && cgPriceResponse.data.market_data) {
                const marketData = cgPriceResponse.data.market_data;
                price = marketData.current_price?.usd || 0;
                volume24h = marketData.total_volume?.usd || 0;
                marketCap = marketData.market_cap?.usd || 0;
              }
            }
          } catch (cgError) {
            console.log('Impossible de récupérer les prix depuis Coingecko:', cgError.message);
          }
        }
        
        // Si Coingecko échoue, essayer Solscan
        if (price === 0) {
          try {
            const priceResponse = await this.enqueueApiRequest(`https://api.solscan.io/market?symbol=${tokenAddress}`);
            if (priceResponse.data && priceResponse.data.data) {
              const marketData = priceResponse.data.data;
              price = marketData.priceUsd || 0;
              volume24h = marketData.volumeUsd || 0;
              marketCap = marketData.marketCapUsd || 0;
            }
          } catch (solscanError) {
            console.log('Impossible de récupérer les prix depuis Solscan:', solscanError.message);
          }
        }
      } catch (marketError) {
        console.log('Impossible de récupérer les données de marché:', marketError.message);
      }
      
      const tokenInfo = {
        address: tokenAddress,
        mint: tokenAddress,
        name: tokenMetadata.name || `Token ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`,
        symbol: tokenMetadata.symbol || 'SOL',
        logoURI: tokenMetadata.logoURI,
        decimals: supplyInfo.decimals,
        totalSupply: supplyInfo.amount,
        price,
        volume24h,
        marketCap,
        createdAt: new Date()
      };
      
      console.log(`Informations complètes récupérées pour ${tokenAddress}`);
      return tokenInfo;
    } catch (error) {
      console.error('Erreur lors de la récupération des informations du token:', error);
      
      // Retourner un objet token minimal en cas d'erreur
      return {
        address: tokenAddress,
        mint: tokenAddress,
        name: `Token ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`,
        symbol: 'SOL',
        decimals: 9,
        totalSupply: 0,
        price: 0,
        volume24h: 0,
        marketCap: 0,
        createdAt: new Date()
      };
    }
  }

  async getRecentTokens(limit = 10) {
    try {
      console.log(`Récupération des ${limit} tokens les plus récents...`);
      
      // Limiter le nombre de requêtes pour éviter les erreurs 429
      const adjustedLimit = Math.min(limit, 10);
      
      // D'abord vérifier les tokens existants dans la base de données
      const existingTokens = await Token.find().sort({ createdAt: -1 }).limit(adjustedLimit);
      if (existingTokens.length > 0) {
        console.log(`${existingTokens.length} tokens existants trouvés en base de données`);
        return existingTokens;
      }
      
      // Récupérer les dernières signatures de transactions du TOKEN_PROGRAM_ID
      let signatures = [];
      
      try {
        signatures = await this.connection.getSignaturesForAddress(
          TOKEN_PROGRAM_ID,
          { limit: 100 }
        );
      } catch (mainSignaturesError) {
        console.log('Erreur lors de la récupération des signatures, essai avec un endpoint alternatif');
        const fallbackConnection = this.getFallbackConnection();
        signatures = await fallbackConnection.getSignaturesForAddress(
          TOKEN_PROGRAM_ID,
          { limit: 100 }
        );
      }
      
      if (!signatures || signatures.length === 0) {
        console.log('Aucune signature trouvée');
        return [];
      }
      
      console.log(`${signatures.length} signatures trouvées, traitement...`);
      
      const processedMints = new Set();
      const tokens = [];
      
      // Traiter les signatures pour trouver de nouveaux tokens
      for (let i = 0; i < Math.min(20, signatures.length); i++) {
        const signatureInfo = signatures[i];
        
        if (tokens.length >= adjustedLimit) break;
        
        try {
          await this.sleep(1000);
          
          let transaction;
          try {
            transaction = await this.connection.getTransaction(signatureInfo.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            });
          } catch (txError) {
            console.log('Erreur RPC, utilisation du fallback:', txError.message);
            const fallbackConnection = this.getFallbackConnection();
            transaction = await fallbackConnection.getTransaction(signatureInfo.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0
            });
          }
          
          if (!transaction || !transaction.meta || !transaction.meta.postTokenBalances) {
            continue;
          }
          
          for (const tokenBalance of transaction.meta.postTokenBalances) {
            if (tokens.length >= adjustedLimit) break;
            
            const mint = tokenBalance.mint;
            
            if (!mint || processedMints.has(mint)) continue;
            processedMints.add(mint);
            
            try {
              const tokenInfo = await this.getTokenInfo(mint, false);
              
              // Ne prendre que les tokens avec des informations valides
              if (tokenInfo.name && tokenInfo.symbol) {
                tokens.push(tokenInfo);
                
                // Sauvegarder dans la base de données
                try {
                  const newToken = new Token(tokenInfo);
                  await newToken.save();
                  console.log(`Nouveau token ajouté: ${tokenInfo.name} (${tokenInfo.symbol})`);
                } catch (saveError) {
                  console.error('Erreur lors de la sauvegarde du token:', saveError.message);
                }
              }
            } catch (tokenError) {
              console.error('Erreur lors du traitement du token:', tokenError);
            }
          }
        } catch (txError) {
          console.error('Erreur lors de la récupération de la transaction:', txError);
        }
      }
      
      console.log(`${tokens.length} tokens récupérés avec succès`);
      return tokens;
    } catch (error) {
      console.error('Erreur lors de la récupération des tokens récents:', error);
      return [];
    }
  }

  async trackNewTokens() {
    try {
      console.log('Suivi des nouveaux tokens...');
      // Cette fonction utilise le SolanaWatcher pour le suivi en temps réel
    } catch (error) {
      console.error('Erreur lors du suivi des tokens:', error);
    }
  }

  async updateTokenPrice(tokenAddress) {
    try {
      const token = await Token.findOne({ mint: tokenAddress });
      if (!token) {
        throw new Error('Token non trouvé');
      }
      
      let price = 0;
      let volume24h = 0;
      let marketCap = 0;
      
      // Essayer d'abord Coingecko
      try {
        const tokenSymbol = token.symbol ? token.symbol.toLowerCase() : '';
        const tokenName = token.name ? token.name.toLowerCase() : '';
        
        if (tokenSymbol || tokenName) {
          const cgSearchResponse = await axios.get(
            `https://api.coingecko.com/api/v3/search?query=${tokenSymbol || tokenName}`,
            { timeout: 5000 }
          );
          
          if (cgSearchResponse.data && cgSearchResponse.data.coins && cgSearchResponse.data.coins.length > 0) {
            const coin = cgSearchResponse.data.coins[0];
            const coinId = coin.id;
            
            const cgPriceResponse = await axios.get(
              `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
              { timeout: 5000 }
            );
            
            if (cgPriceResponse.data && cgPriceResponse.data.market_data) {
              const marketData = cgPriceResponse.data.market_data;
              price = marketData.current_price?.usd || 0;
              volume24h = marketData.total_volume?.usd || 0;
              marketCap = marketData.market_cap?.usd || 0;
            }
          }
        }
      } catch (cgError) {
        console.log('Impossible de récupérer les prix depuis Coingecko:', cgError.message);
      }
      
      // Si Coingecko échoue, essayer Solscan
      if (price === 0) {
        try {
          const priceResponse = await this.enqueueApiRequest(`https://api.solscan.io/market?symbol=${tokenAddress}`);
          if (priceResponse.data && priceResponse.data.data) {
            const marketData = priceResponse.data.data;
            price = marketData.priceUsd || 0;
            volume24h = marketData.volumeUsd || 0;
            marketCap = marketData.marketCapUsd || 0;
          }
        } catch (solscanError) {
          console.log('Impossible de récupérer les prix depuis Solscan:', solscanError.message);
        }
      }
      
      if (price > 0 || volume24h > 0 || marketCap > 0) {
        token.price = price;
        token.volume24h = volume24h;
        token.marketCap = marketCap;
        token.lastUpdated = new Date();
        await token.save();
        console.log(`Prix mis à jour pour ${token.name}: $${price}`);
        return token;
      } else {
        console.log(`Aucune information de prix trouvée pour ${token.name}`);
        return token;
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du prix:', error);
      throw error;
    }
  }

  // Essayer de récupérer les données sans utiliser Solscan
  async getMetadataWithoutSolscan(tokenAddress) {
    console.log("Contournement de Solscan pour récupérer les métadonnées...");
    
    // Essayer d'abord Jupiter qui a beaucoup de données sur les tokens
    try {
      const jupiterResponse = await axios.get(`https://token.jup.ag/all`, { 
        timeout: 5000,
        headers: {
          'User-Agent': this.getNextUserAgent()
        }
      });
      const jupiterTokens = jupiterResponse.data;
      
      const token = jupiterTokens.find(t => t.address === tokenAddress);
      if (token) {
        return {
          name: token.name,
          symbol: token.symbol,
          logoURI: token.logoURI,
          source: 'Jupiter'
        };
      }
    } catch (jupiterError) {
      console.log('Impossible de récupérer les métadonnées depuis Jupiter:', jupiterError.message);
    }
    
    // Essayer avec Solana Token List
    try {
      const tokenListResponse = await axios.get(
        'https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json',
        { 
          timeout: 5000,
          headers: {
            'User-Agent': this.getNextUserAgent()
          }
        }
      );
      
      if (tokenListResponse.data && tokenListResponse.data.tokens) {
        const token = tokenListResponse.data.tokens.find(t => t.address === tokenAddress);
        if (token) {
          return {
            name: token.name,
            symbol: token.symbol,
            logoURI: token.logoURI,
            source: 'Solana Token List'
          };
        }
      }
    } catch (tokenListError) {
      console.log('Impossible de récupérer les métadonnées depuis Solana Token List:', tokenListError.message);
    }
    
    // Si toutes les sources échouent, créer des métadonnées génériques
    return {
      name: `Token ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`,
      symbol: 'UNKNOWN',
      logoURI: null,
      source: 'Fallback'
    };
  }
}

module.exports = SolanaService; 