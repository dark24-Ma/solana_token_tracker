/**
 * Service pour gérer les données des tokens
 */
class TokenService {
  /**
   * Récupère tous les tokens depuis l'API
   * @returns {Promise<Array>} Liste des tokens
   */
  static async fetchAllTokens() {
    try {
      const response = await fetch('http://localhost:3000/api/tokens');
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // L'API peut retourner soit un tableau, soit un objet avec une propriété "tokens"
      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray(data.tokens)) {
        return data.tokens;
      } else {
        console.warn('Format de réponse inattendu:', data);
        return this.getDemoTokens();
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des tokens:', error);
      // En cas d'erreur, utiliser des données de démo
      return this.getDemoTokens();
    }
  }

  /**
   * Récupère un token par son adresse
   * @param {string} address Adresse du token
   * @returns {Promise<Object>} Données du token
   */
  static async fetchTokenByAddress(address) {
    try {
      const response = await fetch(`http://localhost:3000/api/tokens/${address}`);
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Erreur lors de la récupération du token ${address}:`, error);
      // Retourner un token de démo si l'adresse commence par "demo-"
      if (address.startsWith('demo-')) {
        const id = address.split('-')[2];
        return this.createDemoToken(parseInt(id) || 1);
      }
      throw error;
    }
  }

  /**
   * Génère des tokens de démonstration
   * @returns {Array} Liste de tokens de démo
   */
  static getDemoTokens() {
    const demoTokens = [];
    for (let i = 1; i <= 20; i++) {
      demoTokens.push(this.createDemoToken(i));
    }
    return demoTokens;
  }

  /**
   * Crée un token de démo avec l'index spécifié
   * @param {number} index Index du token de démo
   * @returns {Object} Token de démo
   */
  static createDemoToken(index) {
    return {
      address: `demo-token-${index}`,
      mint: `demo-mint-${index}`,
      name: `Demo Token ${index}`,
      symbol: `DT${index}`,
      decimals: 9,
      totalSupply: index * 1000000,
      price: index * 0.1,
      volume24h: index * 10000,
      marketCap: index * 100000,
      createdAt: new Date().toISOString()
    };
  }
}

export default TokenService; 