<template>
  <div class="token-details" v-if="token">
    <div class="token-header">
      <h2>{{ token.name }} ({{ token.symbol }})</h2>
      <button @click="$router.push('/')" class="back-button">Retour</button>
    </div>

    <div class="token-info">
      <div class="info-card">
        <h3>Informations générales</h3>
        <p><strong>Adresse:</strong> {{ token.address }}</p>
        <p><strong>Décimals:</strong> {{ token.decimals }}</p>
        <p><strong>Créé le:</strong> {{ new Date(token.createdAt).toLocaleDateString() }}</p>
        <p><strong>Dernière mise à jour:</strong> {{ new Date(token.lastUpdated).toLocaleDateString() }}</p>
      </div>

      <div class="info-card">
        <h3>Statistiques</h3>
        <p><strong>Prix actuel:</strong> ${{ token.price.toFixed(6) }}</p>
        <p><strong>Volume 24h:</strong> ${{ token.volume24h.toLocaleString() }}</p>
        <p><strong>Market Cap:</strong> ${{ token.marketCap.toLocaleString() }}</p>
      </div>
    </div>

    <div class="chart-section">
      <h3>Évolution du prix</h3>
      <TokenChart :price-history="priceHistory" />
    </div>
  </div>
  <div v-else class="loading">
    Chargement des détails du token...
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import TokenChart from './TokenChart.vue';

export default {
  name: 'TokenDetails',
  components: {
    TokenChart
  },
  data() {
    return {
      priceHistory: []
    };
  },
  computed: {
    ...mapState({
      token: state => state.currentToken,
      loading: state => state.loading
    })
  },
  methods: {
    ...mapActions(['fetchTokenByAddress']),
    async fetchPriceHistory() {
      // Simuler des données historiques pour l'exemple
      this.priceHistory = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 3600000),
        price: this.token.price * (1 + (Math.random() - 0.5) * 0.1)
      }));
    }
  },
  async created() {
    const address = this.$route.params.address;
    await this.fetchTokenByAddress(address);
    if (this.token) {
      await this.fetchPriceHistory();
    }
  }
};
</script>

<style scoped>
.token-details {
  padding: 20px;
}

.token-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.back-button {
  padding: 8px 16px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.token-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.info-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.chart-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.loading {
  text-align: center;
  padding: 40px;
  font-size: 18px;
}
</style> 