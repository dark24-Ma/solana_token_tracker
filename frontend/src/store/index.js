import { createStore } from 'vuex';
import { io } from 'socket.io-client';
import TokenService from '../services/tokenService';

export default createStore({
  state: {
    tokens: [],
    currentToken: null,
    loading: false,
    error: null,
    newTokens: [],
    pagination: {
      currentPage: 1,
      limit: 12,
      totalPages: 1
    }
  },
  mutations: {
    SET_TOKENS(state, tokens) {
      state.tokens = Array.isArray(tokens) ? tokens : [];
      state.pagination.totalPages = Math.max(1, Math.ceil(state.tokens.length / state.pagination.limit));
    },
    SET_CURRENT_TOKEN(state, token) {
      state.currentToken = token;
    },
    SET_LOADING(state, loading) {
      state.loading = loading;
    },
    SET_ERROR(state, error) {
      state.error = error;
    },
    ADD_NEW_TOKEN(state, token) {
      if (!Array.isArray(state.tokens)) {
        state.tokens = [];
      }
      state.tokens.unshift(token);
      state.newTokens.unshift(token);
      if (state.newTokens.length > 5) {
        state.newTokens.pop();
      }
      state.pagination.totalPages = Math.max(1, Math.ceil(state.tokens.length / state.pagination.limit));
    },
    SET_PAGE(state, page) {
      if (page >= 1 && page <= state.pagination.totalPages) {
        state.pagination.currentPage = page;
      }
    },
    ADD_DEMO_TOKENS(state) {
      // Ajouter des tokens de démo si aucun token n'existe
      if (state.tokens.length === 0) {
        const demoTokens = [];
        for (let i = 1; i <= 10; i++) {
          demoTokens.push({
            address: `demo-token-${i}`,
            mint: `demo-mint-${i}`,
            name: `Demo Token ${i}`,
            symbol: `DT${i}`,
            decimals: 9,
            totalSupply: i * 1000000,
            price: i * 0.1,
            volume24h: i * 10000,
            marketCap: i * 100000,
            createdAt: new Date().toISOString()
          });
        }
        state.tokens = demoTokens;
        state.pagination.totalPages = Math.max(1, Math.ceil(demoTokens.length / state.pagination.limit));
      }
    }
  },
  actions: {
    async fetchTokens({ commit }) {
      commit('SET_LOADING', true);
      try {
        const tokens = await TokenService.fetchAllTokens();
        commit('SET_TOKENS', tokens);
      } catch (error) {
        console.error('Erreur lors de la récupération des tokens:', error);
        commit('SET_ERROR', `Impossible de charger les tokens: ${error.message}`);
      } finally {
        commit('SET_LOADING', false);
      }
    },
    async fetchTokenByAddress({ commit }, address) {
      commit('SET_LOADING', true);
      try {
        const token = await TokenService.fetchTokenByAddress(address);
        commit('SET_CURRENT_TOKEN', token);
      } catch (error) {
        commit('SET_ERROR', `Impossible de charger le token: ${error.message}`);
      } finally {
        commit('SET_LOADING', false);
      }
    },
    initializeWebSocket({ commit }) {
      const socket = io('http://localhost:3000');
      
      socket.on('newToken', (token) => {
        commit('ADD_NEW_TOKEN', token);
      });

      socket.on('error', (error) => {
        commit('SET_ERROR', error.message);
      });
    }
  },
  getters: {
    getTokens: state => Array.isArray(state.tokens) ? state.tokens : [],
    getCurrentToken: state => state.currentToken,
    isLoading: state => state.loading,
    getError: state => state.error,
    getNewTokens: state => Array.isArray(state.newTokens) ? state.newTokens : [],
    getPaginatedTokens: state => {
      const tokens = Array.isArray(state.tokens) ? state.tokens : [];
      const start = (state.pagination.currentPage - 1) * state.pagination.limit;
      const end = start + state.pagination.limit;
      return tokens.slice(start, end);
    },
    getTotalPages: state => state.pagination.totalPages,
    getCurrentPage: state => state.pagination.currentPage
  }
}); 