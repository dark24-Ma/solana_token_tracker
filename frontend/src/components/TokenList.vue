<template>
  <div class="token-list">
    <div class="header-actions">
      <h2>Liste des Tokens Solana</h2>
      <div class="search-container">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Rechercher un token..." 
          class="form-control"
        />
        <select v-model="sortBy" class="form-select">
          <option value="createdAt">Date de création</option>
          <option value="price">Prix</option>
          <option value="volume24h">Volume 24h</option>
          <option value="marketCap">Market Cap</option>
        </select>
      </div>
    </div>
    
    <div v-if="loading" class="loading">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Chargement...</span>
      </div>
    </div>
    
    <div v-if="error" class="alert alert-danger" role="alert">
      {{ error }}
    </div>

    <div class="new-tokens-section" v-if="newTokens.length">
      <h3 class="section-title">Nouveaux Tokens</h3>
      <div class="tokens-grid">
        <div 
          v-for="token in newTokens" 
          :key="token.address" 
          class="token-card new"
          @click="showTokenDetails(token)"
        >
          <div class="token-header">
            <h3>{{ token.name }}</h3>
            <span class="badge bg-success">Nouveau</span>
          </div>
          <div class="token-info">
            <p><strong>Symbole:</strong> {{ token.symbol }}</p>
            <p><strong>Prix:</strong> ${{ formatNumber(token.price) }}</p>
            <p><strong>Volume 24h:</strong> ${{ formatNumber(token.volume24h) }}</p>
            <p><strong>Market Cap:</strong> ${{ formatNumber(token.marketCap) }}</p>
          </div>
          <div class="token-footer">
            <small>Créé le: {{ formatDate(token.createdAt) }}</small>
          </div>
        </div>
      </div>
    </div>

    <div class="tokens-grid">
      <div 
        v-for="token in filteredTokens" 
        :key="token.address" 
        class="token-card"
        @click="showTokenDetails(token)"
      >
        <div class="token-header">
          <h3>{{ token.name }}</h3>
          <span class="badge bg-primary">{{ token.symbol }}</span>
        </div>
        <div class="token-info">
          <p><strong>Prix:</strong> ${{ formatNumber(token.price) }}</p>
          <p><strong>Volume 24h:</strong> ${{ formatNumber(token.volume24h) }}</p>
          <p><strong>Market Cap:</strong> ${{ formatNumber(token.marketCap) }}</p>
          <p><strong>Supply Total:</strong> {{ formatNumber(token.totalSupply) }}</p>
        </div>
        <div class="token-footer">
          <small>Créé le: {{ formatDate(token.createdAt) }}</small>
          <a 
            :href="`https://solscan.io/token/${token.address}`" 
            target="_blank"
            class="btn btn-sm btn-outline-primary"
            @click.stop
          >
            Voir sur Solscan
          </a>
        </div>
      </div>
    </div>

    <div class="pagination" v-if="totalPages > 1">
      <nav aria-label="Page navigation">
        <ul class="pagination">
          <li class="page-item" :class="{ disabled: currentPage === 1 }">
            <a class="page-link" href="#" @click.prevent="changePage(currentPage - 1)">Précédent</a>
          </li>
          <li class="page-item" v-for="page in totalPages" :key="page" :class="{ active: currentPage === page }">
            <a class="page-link" href="#" @click.prevent="changePage(page)">{{ page }}</a>
          </li>
          <li class="page-item" :class="{ disabled: currentPage === totalPages }">
            <a class="page-link" href="#" @click.prevent="changePage(currentPage + 1)">Suivant</a>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions, mapGetters, mapMutations } from 'vuex';

export default {
  name: 'TokenList',
  data() {
    return {
      searchQuery: '',
      sortBy: 'createdAt',
      order: 'desc'
    };
  },
  computed: {
    ...mapState({
      loading: state => state.loading,
      error: state => state.error
    }),
    ...mapGetters([
      'getNewTokens',
      'getPaginatedTokens',
      'getTotalPages',
      'getCurrentPage'
    ]),
    newTokens() {
      return this.getNewTokens;
    },
    currentPage() {
      return this.getCurrentPage;
    },
    totalPages() {
      return this.getTotalPages;
    },
    filteredTokens() {
      let filtered = [...this.getPaginatedTokens];
      
      // Filtrage par recherche
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(token => 
          token.name.toLowerCase().includes(query) || 
          token.symbol.toLowerCase().includes(query) ||
          token.address.toLowerCase().includes(query)
        );
      }
      
      // Tri
      filtered.sort((a, b) => {
        const aValue = a[this.sortBy];
        const bValue = b[this.sortBy];
        return this.order === 'desc' ? bValue - aValue : aValue - bValue;
      });
      
      return filtered;
    }
  },
  methods: {
    ...mapActions(['fetchTokens', 'initializeWebSocket']),
    ...mapMutations(['SET_PAGE']),
    formatNumber(number) {
      return new Intl.NumberFormat('fr-FR').format(number);
    },
    formatDate(date) {
      return new Date(date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    showTokenDetails(token) {
      this.$router.push(`/token/${token.address}`);
    },
    changePage(page) {
      this.SET_PAGE(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },
  mounted() {
    this.fetchTokens();
    this.initializeWebSocket();
  }
};
</script>

<style scoped>
.token-list {
  padding: 20px;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.search-container {
  display: flex;
  gap: 10px;
}

.search-container input,
.search-container select {
  width: 200px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.tokens-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.token-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.3s ease;
}

.token-card:hover {
  transform: translateY(-5px);
}

.token-card.new {
  border: 2px solid #28a745;
}

.token-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.token-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.token-info {
  margin-bottom: 10px;
}

.token-info p {
  margin: 5px 0;
}

.token-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.section-title {
  margin: 20px 0;
  color: #333;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style> 