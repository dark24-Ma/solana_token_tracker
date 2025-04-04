const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true
  },
  mint: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    required: true
  },
  decimals: {
    type: Number,
    required: true
  },
  totalSupply: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    default: 0
  },
  priceUsd: {
    type: Number,
    default: 0
  },
  priceChange24h: {
    type: Number,
    default: 0
  },
  volume24h: {
    type: Number,
    default: 0
  },
  liquidity: {
    type: Number,
    default: 0
  },
  marketCap: {
    type: Number,
    default: 0
  },
  fdv: {
    type: Number, // Fully Diluted Valuation
    default: 0
  },
  pairAddress: {
    type: String,
    default: null
  },
  exchange: {
    type: String,
    default: null
  },
  logoURI: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  creator: {
    type: String,
    default: null
  },
  holdersCount: {
    type: Number,
    default: 0
  },
  isMemecoin: {
    type: Boolean,
    default: false
  },
  tokenType: {
    type: String,
    enum: ['standard', 'memecoin', 'utility', 'governance', 'nft', 'defi', 'other'],
    default: 'standard'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'lastUpdated' }
});

// Index pour recherche rapide
tokenSchema.index({ address: 1, mint: 1 });
tokenSchema.index({ symbol: 1 });
tokenSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Token', tokenSchema); 