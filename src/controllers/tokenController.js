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
      
      // Filtrer pour n'avoir que les memecoins et les tokens avec liquidité
      const memecoins = await Promise.all(
        recentTokens.map(async token => {
          // Vérifier que les propriétés essentielles existent
          if (!token.address || !token.mint) {
            console.log("Token sans adresse ignoré");
            return null;
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
            return null;
          }
          
          // Vérifier s'il est déjà dans notre base de données
          const existingToken = await Token.findOne({ mint: token.mint });
          
          // Préparer des valeurs formatées pour l'affichage, avec gestion des valeurs manquantes
          const priceUsd = token.priceUsd || 0;
          const liquidity = token.liquidity || 0;
          const volume24h = token.volume24h || 0;
          const priceChange24h = token.priceChange24h || 0;
          
          const priceChangeColor = priceChange24h > 0 ? 'green' : 
                                  priceChange24h < 0 ? 'red' : 'gray';
          
          // Ajouter les nouvelles propriétés du format DexScreener
          return {
            ...token,
            name: tokenName,
            symbol: tokenSymbol,
            priceUsd: priceUsd,
            liquidity: liquidity,
            volume24h: volume24h,
            priceChange24h: priceChange24h,
            isMemecoin,
            tokenType: isMemecoin ? 'memecoin' : 'standard',
            isNew: !existingToken,
            marketData: {
              priceChangeColor,
              priceFormatted: `$${priceUsd.toFixed(priceUsd < 0.01 ? 8 : 4)}`,
              liquidityFormatted: `$${liquidity.toLocaleString()}`,
              volume24hFormatted: `$${volume24h.toLocaleString()}`,
              priceChange24hFormatted: `${priceChange24h > 0 ? '+' : ''}${priceChange24h.toFixed(2)}%`,
              createdFormatted: token.createdAt ? new Date(token.createdAt).toLocaleString() : 'Récent'
            },
            // Nouvelles propriétés
            website: token.website || null,
            twitter: token.twitter || null,
            logoURI: token.logoURI || token.icon || null,
            headerURI: token.headerURI || token.header || null
          };
        })
      );
      
      // Filtrer les tokens null et trier par date de création (plus récent d'abord)
      const filteredTokens = memecoins
        .filter(token => token !== null)
        .sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return b.createdAt - a.createdAt;
        });
      
      res.json({
        tokens: filteredTokens,
        count: filteredTokens.length,
        memecoinCount: filteredTokens.filter(t => t.isMemecoin).length,
        message: "Tokens récupérés en direct depuis DexScreener"
      });
    } catch (error) {
      console.error("Erreur:", error);
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