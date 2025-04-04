const Token = require('../models/Token');
const SolanaService = require('../services/solanaService');

class TokenController {
  constructor(solanaService) {
    this.solanaService = solanaService;
  }

  // Récupérer tous les tokens
  async getAllTokens(req, res) {
    try {
      const { page = 1, limit = 50, sortBy = 'createdAt', order = 'desc', type = null } = req.query;
      
      // Construire le filtre de base
      let filter = {};
      
      // Filtrer par type (memecoin, etc.)
      if (type === 'memecoins') {
        // Les memecoins ont généralement ces caractéristiques:
        // - Nom "meme-like" ou description humoristique
        // - Supply élevée
        // - Faible prix unitaire
        // - Créés récemment
        
        // Cette regex recherche des tokens dont le nom contient des mots-clés typiques des memecoins
        const memecoinKeywords = /(doge|shib|pepe|cat|inu|moon|wojak|meme|moon|rocket|lambo|ape|frog)/i;
        filter = {
          $or: [
            { name: memecoinKeywords },
            { symbol: memecoinKeywords }
          ]
        };
      }
      
      const tokens = await Token.find(filter)
        .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      // Renvoyer directement le tableau de tokens
      res.json(tokens);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Récupérer un token par son adresse
  async getTokenByAddress(req, res) {
    try {
      const token = await Token.findOne({ address: req.params.address });
      if (!token) {
        return res.status(404).json({ message: 'Token non trouvé' });
      }
      res.json(token);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Ajouter un nouveau token
  async addToken(req, res) {
    try {
      const tokenInfo = await this.solanaService.getTokenInfo(req.body.address);
      
      const token = new Token({
        address: req.body.address,
        name: req.body.name,
        symbol: req.body.symbol,
        decimals: tokenInfo.decimals,
        price: req.body.price || 0,
        volume24h: req.body.volume24h || 0,
        marketCap: req.body.marketCap || 0
      });

      const newToken = await token.save();
      res.status(201).json(newToken);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  // Mettre à jour les informations d'un token
  async updateToken(req, res) {
    try {
      const token = await Token.findOne({ address: req.params.address });
      if (!token) {
        return res.status(404).json({ message: 'Token non trouvé' });
      }

      if (req.body.name) token.name = req.body.name;
      if (req.body.symbol) token.symbol = req.body.symbol;
      if (req.body.price) token.price = req.body.price;
      if (req.body.volume24h) token.volume24h = req.body.volume24h;
      if (req.body.marketCap) token.marketCap = req.body.marketCap;
      
      token.lastUpdated = new Date();
      const updatedToken = await token.save();
      
      res.json(updatedToken);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  // Supprimer un token
  async deleteToken(req, res) {
    try {
      const token = await Token.findOne({ address: req.params.address });
      if (!token) {
        return res.status(404).json({ message: 'Token non trouvé' });
      }

      await token.remove();
      res.json({ message: 'Token supprimé avec succès' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Route spécifique pour les memecoins
  async getMemecoins(req, res) {
    try {
      const { page = 1, limit = 50, sortBy = 'createdAt', order = 'desc' } = req.query;
      
      // Regex pour identifier les memecoins basée sur le nom et le symbole
      const memecoinKeywords = /(doge|shib|pepe|cat|inu|moon|wojak|meme|moon|rocket|lambo|ape|frog)/i;
      
      const filter = {
        $or: [
          { name: memecoinKeywords },
          { symbol: memecoinKeywords }
        ]
      };
      
      const tokens = await Token.find(filter)
        .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();
        
      // Compter le nombre total de memecoins
      const count = await Token.countDocuments(filter);
      
      // Renvoyer les memecoins avec pagination
      res.json({
        tokens,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalTokens: count
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  
  // Récupérer les tokens les plus récents
  async getRecentTokens(req, res) {
    try {
      const { limit = 20, hours = 24 } = req.query;
      
      // Calculer la date de début (maintenant - heures)
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - parseInt(hours));
      
      // Filtre par date de création
      const filter = {
        createdAt: { $gte: startDate }
      };
      
      // Récupérer les tokens récents
      const tokens = await Token.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .exec();
      
      // Compter le nombre total de tokens récents
      const count = await Token.countDocuments(filter);
      
      res.json({
        tokens,
        totalRecent: count,
        timeframe: `${hours} dernières heures`
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Récupérer les memecoins récemment listés (de notre base de données)
  async getRecentMemecoins(req, res) {
    try {
      const { limit = 20, minLiquidity = 0, hours = 24 } = req.query;
      
      // Calculer la date de début (maintenant - heures)
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - parseInt(hours));
      
      // Filtre pour les memecoins récents avec liquité minimum
      const filter = {
        isMemecoin: true,
        createdAt: { $gte: startDate },
        liquidity: { $gte: parseFloat(minLiquidity) }
      };
      
      // Récupérer les tokens récents
      const tokens = await Token.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .exec();
      
      // Compter le nombre total de tokens récents
      const count = await Token.countDocuments(filter);
      
      // Enrichir la réponse avec des informations supplémentaires
      const enrichedTokens = tokens.map(token => {
        const priceChangeColor = token.priceChange24h > 0 ? 'green' : 
                                token.priceChange24h < 0 ? 'red' : 'gray';
        
        return {
          ...token.toObject(),
          marketData: {
            priceChangeColor,
            priceFormatted: `$${token.priceUsd.toFixed(token.priceUsd < 0.01 ? 8 : 4)}`,
            liquidityFormatted: `$${(token.liquidity || 0).toLocaleString()}`,
            volume24hFormatted: `$${(token.volume24h || 0).toLocaleString()}`,
            priceChange24hFormatted: `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%`,
            age: this.getTokenAge(token.createdAt)
          }
        };
      });
      
      res.json({
        tokens: enrichedTokens,
        totalRecent: count,
        timeframe: `${hours} dernières heures`
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  
  // Récupérer les memecoins en temps réel depuis DexScreener
  async getLiveNewMemecoins(req, res) {
    try {
      console.log("Récupération des memecoins en direct depuis DexScreener...");
      
      // Récupérer les tokens récents directement depuis DexScreener
      const recentTokens = await this.solanaService.getRecentTokensFromDexScreener(50);
      
      if (!recentTokens || recentTokens.length === 0) {
        return res.json({
          tokens: [],
          message: "Aucun token récent trouvé sur DexScreener"
        });
      }
      
      // Pour le suivi des opérations
      const newTokensSaved = []; // Tokens nouvellement créés
      const tokensUpdated = [];  // Tokens mis à jour
      const processedTokens = []; // Tous les tokens traités pour l'affichage
      
      // Traiter chaque token
      for (const token of recentTokens) {
        try {
          // Vérifier que les propriétés essentielles existent
          if (!token.address || !token.mint) {
            console.log("Token sans adresse ignoré");
            continue;
          }
          
          // Utiliser une valeur par défaut pour les propriétés manquantes
          const tokenName = token.name || `Token ${token.mint.slice(0, 6)}...`;
          const tokenSymbol = token.symbol || 'UNKNOWN';
          
          // Vérifier si c'est un memecoin
          const nameLower = tokenName.toLowerCase();
          const symbolLower = tokenSymbol.toLowerCase();
          
          // Liste de mots-clés associés aux memecoins
          const memecoinKeywords = [
            'doge', 'shib', 'pepe', 'cat', 'inu', 'moon', 'wojak', 'meme', 
            'rocket', 'lambo', 'ape', 'frog', 'chad', 'pump', 'dump', 'elon', 
            'safe', 'diamond', 'hands', 'tendies', 'wojak', 'degen', 'gme', 
            'amc', 'apes', 'bulls', 'bears', 'kek', 'fomo', 'hodl', 'bonk',
            'trump', 'gold', 'rich', 'mil'
          ];
          
          // Vérifier si l'un des mots-clés est présent dans le nom ou le symbole
          const hasKeyword = memecoinKeywords.some(keyword => 
            nameLower.includes(keyword) || symbolLower.includes(keyword)
          );
          
          // Vérifier les caractéristiques des memecoins (si disponibles)
          const hasLargeSupply = token.totalSupply > 1000000000;
          const hasLowPrice = token.priceUsd < 0.01;
          
          const isMemecoin = hasKeyword || (hasLargeSupply && hasLowPrice);
          
          // Filtrer les tokens non-memecoins avec faible liquidité
          if (!isMemecoin && token.liquidity < 1000) {
            continue;
          }
          
          // Préparer des valeurs formatées avec gestion des valeurs manquantes
          const priceUsd = token.priceUsd || 0;
          const liquidity = token.liquidity || 0;
          const volume24h = token.volume24h || 0;
          const priceChange24h = token.priceChange24h || 0;
          
          // Vérifier si le token existe déjà dans la base de données
          let existingToken = await Token.findOne({ mint: token.mint });
          let isNewToken = false;
          
          // Si le token n'existe pas, le créer
          if (!existingToken) {
            try {
              // Préparation des données pour un nouveau token
              const newToken = new Token({
                mint: token.mint,
                address: token.address,
                name: tokenName,
                symbol: tokenSymbol,
                priceUsd: priceUsd,
                price: priceUsd,
                liquidity: liquidity,
                volume24h: volume24h,
                priceChange24h: priceChange24h,
                isMemecoin: isMemecoin,
                tokenType: isMemecoin ? 'memecoin' : 'standard',
                website: token.website || null,
                twitter: token.twitter || null,
                logoURI: token.logoURI || token.icon || null,
                headerURI: token.headerURI || token.header || null,
                pairAddress: token.pairAddress || null,
                exchange: token.exchange || null,
                fdv: token.fdv || 0,
                createdAt: token.createdAt || new Date(),
                lastUpdated: new Date()
              });
              
              // Sauvegarder le nouveau token
              await newToken.save();
              newTokensSaved.push(token.mint);
              existingToken = newToken; // Pour l'utiliser dans la réponse
              isNewToken = true;
              
              console.log(`Nouveau token enregistré: ${tokenName} (${tokenSymbol})`);
            } catch (saveError) {
              // Si erreur lors de la création, ignorer simplement ce token
              console.error(`Erreur lors de l'enregistrement du token ${tokenName}:`, saveError.message);
              continue;
            }
          } else {
            // Token existant - Mettre à jour uniquement les données de marché qui changent souvent
            try {
              // Ne mettre à jour que les données importantes comme prix et liquidité
              const updates = {
                priceUsd: priceUsd,
                price: priceUsd,
                liquidity: liquidity,
                volume24h: volume24h,
                priceChange24h: priceChange24h,
                lastUpdated: new Date()
              };
              
              // Si les propriétés importantes manquent, les mettre à jour aussi
              if (!existingToken.logoURI && (token.logoURI || token.icon)) {
                updates.logoURI = token.logoURI || token.icon;
              }
              
              if (!existingToken.website && token.website) {
                updates.website = token.website;
              }
              
              if (!existingToken.twitter && token.twitter) {
                updates.twitter = token.twitter;
              }
              
              // Mise à jour avec findOneAndUpdate pour éviter les conflits
              const updatedToken = await Token.findOneAndUpdate(
                { mint: token.mint },
                { $set: updates },
                { new: true, runValidators: true }
              );
              
              tokensUpdated.push(token.mint);
              existingToken = updatedToken; // Pour l'utiliser dans la réponse
            } catch (updateError) {
              console.error(`Erreur lors de la mise à jour du token ${tokenName}:`, updateError.message);
              // Continuer avec la version existante pour l'affichage
            }
          }
          
          // Calculer la couleur pour l'affichage du changement de prix
          const priceChangeColor = priceChange24h > 0 ? 'green' : 
                                  priceChange24h < 0 ? 'red' : 'gray';
          
          // Ajouter le token avec les données formatées pour l'affichage
          processedTokens.push({
            mint: existingToken.mint,
            address: existingToken.address,
            name: existingToken.name,
            symbol: existingToken.symbol,
            priceUsd: existingToken.priceUsd,
            liquidity: existingToken.liquidity,
            volume24h: existingToken.volume24h,
            priceChange24h: existingToken.priceChange24h,
            isMemecoin: existingToken.isMemecoin,
            tokenType: existingToken.tokenType,
            website: existingToken.website,
            twitter: existingToken.twitter,
            logoURI: existingToken.logoURI,
            headerURI: existingToken.headerURI,
            pairAddress: existingToken.pairAddress,
            exchange: existingToken.exchange,
            fdv: existingToken.fdv,
            createdAt: existingToken.createdAt,
            isNew: isNewToken,
            marketData: {
              priceChangeColor,
              priceFormatted: `$${existingToken.priceUsd.toFixed(existingToken.priceUsd < 0.01 ? 8 : 4)}`,
              liquidityFormatted: `$${(existingToken.liquidity || 0).toLocaleString()}`,
              volume24hFormatted: `$${(existingToken.volume24h || 0).toLocaleString()}`,
              priceChange24hFormatted: `${existingToken.priceChange24h > 0 ? '+' : ''}${existingToken.priceChange24h.toFixed(2)}%`,
              createdFormatted: existingToken.createdAt ? new Date(existingToken.createdAt).toLocaleString() : 'Récent',
              age: this.getTokenAge(existingToken.createdAt)
            }
          });
          
        } catch (tokenError) {
          console.error("Erreur lors du traitement d'un token:", tokenError.message);
          // Continuer avec le token suivant
        }
      }
      
      // Trier les tokens par date de création (plus récent d'abord)
      const sortedTokens = processedTokens.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
      // Statistiques des opérations
      console.log(`Traitement terminé:
        - ${newTokensSaved.length} nouveaux tokens enregistrés
        - ${tokensUpdated.length} tokens mis à jour
        - ${processedTokens.length} tokens au total`);
      
      res.json({
        tokens: sortedTokens,
        count: sortedTokens.length,
        memecoinCount: sortedTokens.filter(t => t.isMemecoin).length,
        newCount: newTokensSaved.length,
        updatedCount: tokensUpdated.length,
        message: "Tokens récupérés en direct depuis DexScreener et synchronisés avec la base de données"
      });
    } catch (error) {
      console.error("Erreur générale:", error);
      res.status(500).json({ message: error.message });
    }
  }

  // Fonction utilitaire pour calculer l'âge d'un token
  getTokenAge(createdAt) {
    const now = new Date();
    const diffInMilliseconds = now - new Date(createdAt);
    const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays}d`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mois`;
  }
}

module.exports = TokenController; 