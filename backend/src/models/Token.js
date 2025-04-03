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
  volume24h: {
    type: Number,
    default: 0
  },
  marketCap: {
    type: Number,
    default: 0
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