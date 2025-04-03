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
    default: nu