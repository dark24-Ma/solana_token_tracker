const Token = require('../models/Token');
const SolanaService = require('../services/solanaService');

class TokenController {
  constructor(solanaService) {
    this.solanaService = solanaService;
  }

  // Récupérer tous les tokens
  async getAllTokens(req, res) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;
      const tokens = await Token.find()
        .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      const count = await Token.countDocuments();
      
      res.json({
        tokens,
        totalPages: Math.ceil(count / limit),
        currentPage: page
      });
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
}

module.exports = TokenController; 