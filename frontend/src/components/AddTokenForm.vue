<template>
  <div class="add-token-form">
    <h2>Ajouter un nouveau token</h2>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="address">Adresse du token</label>
        <input
          type="text"
          id="address"
          v-model="form.address"
          required
          placeholder="Adresse du token Solana"
        />
      </div>
      
      <div class="form-group">
        <label for="name">Nom du token</label>
        <input
          type="text"
          id="name"
          v-model="form.name"
          required
          placeholder="Nom du token"
        />
      </div>
      
      <div class="form-group">
        <label for="symbol">Symbole</label>
        <input
          type="text"
          id="symbol"
          v-model="form.symbol"
          required
          placeholder="Symbole (ex: SOL)"
        />
      </div>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Ajout en cours...' : 'Ajouter le token' }}
      </button>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </form>
  </div>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  name: 'AddTokenForm',
  data() {
    return {
      form: {
        address: '',
        name: '',
        symbol: ''
      },
      loading: false,
      error: null
    };
  },
  methods: {
    ...mapActions(['addToken']),
    async handleSubmit() {
      this.loading = true;
      this.error = null;
      
      try {
        await this.addToken(this.form);
        this.form = {
          address: '',
          name: '',
          symbol: ''
        };
        this.$emit('token-added');
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.add-token-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

button {
  width: 100%;
  padding: 10px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.error-message {
  color: red;
  margin-top: 10px;
  text-align: center;
}
</style> 