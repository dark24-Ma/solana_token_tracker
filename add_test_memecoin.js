const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Token = require('./src/models/Token');

dotenv.config();

// Memecoin de test
const testMemecoin = {
  address: "DEGENxyz12345678901234567890123456789012",
  mint: "DEGENxyz12345678901234567890123456789012",
  name: "Doge Moon Rocket",
  symbol: "DOGMOON",
  decimals: 9,
  totalSupply: 1000000000000, // Supply élevée typique des memecoins
  price: 0.0000001, // Prix très bas
  volume24h: 50000,
  marketCap: 100000,
  logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  isMemecoin: true,
  tokenType: "memecoin",
  createdAt: new Date(),
  lastUpdated: new Date()
};

async function addTestMemecoin() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/solana_tracker', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connecté à MongoDB');
    
    // Vérifier si le token existe déjà
    const existingToken = await Token.findOne({ mint: testMemecoin.mint });
    if (existingToken) {
      console.log('Le memecoin de test existe déjà');
      await mongoose.connection.close();
      return;
    }
    
    // Créer le nouveau token
    const newToken = new Token(testMemecoin);
    await newToken.save();
    console.log('Memecoin de test ajouté avec succès');
    
    // Fermer la connexion
    await mongoose.connection.close();
    console.log('Connexion MongoDB fermée');
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

// Exécuter la fonction
addTestMemecoin(); 