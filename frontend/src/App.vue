<template>
  <div id="app">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container">
        <a class="navbar-brand" href="#">Solana Token Tracker</a>
      </div>
    </nav>
    
    <div class="notifications-container">
      <div 
        v-for="(notification, index) in notifications" 
        :key="index"
        :class="['notification', notification.type]"
        @click="removeNotification(index)"
      >
        <div class="notification-content">
          <i :class="notification.icon"></i>
          <div class="notification-message">
            <strong>{{ notification.title }}</strong>
            <p>{{ notification.message }}</p>
          </div>
        </div>
        <div class="notification-progress" :style="{ width: notification.progress + '%' }"></div>
      </div>
    </div>

    <div class="container mt-4">
      <div v-if="showWelcome" class="welcome-message">
        <div class="card">
          <div class="card-body">
            <h2 class="card-title">Bienvenue sur Solana Token Tracker</h2>
            <p class="card-text">Cette application vous permet de suivre les tokens Solana en temps réel. Vous serez notifié dès qu'un nouveau token est détecté sur la blockchain.</p>
            <p>Nous affichons actuellement des données de démonstration car le serveur API n'est pas disponible.</p>
            <button @click="closeWelcome" class="btn btn-primary">Compris</button>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-md-12">
          <router-view />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client';
import { mapActions } from 'vuex';

export default {
  name: 'App',
  data() {
    return {
      notifications: [],
      socket: null,
      showWelcome: true
    };
  },
  created() {
    this.initSocket();
    this.addDebugNotification();
  },
  methods: {
    ...mapActions(['fetchTokens']),
    initSocket() {
      try {
        this.socket = io('http://localhost:3000');
        
        this.socket.on('connect', () => {
          this.addNotification({
            type: 'info',
            title: 'Connexion établie',
            message: 'Connecté au serveur de notifications',
            icon: 'fas fa-check-circle'
          });
        });
        
        this.socket.on('connect_error', (error) => {
          console.error('Erreur de connexion socket:', error);
          this.addNotification({
            type: 'error',
            title: 'Erreur de connexion',
            message: 'Impossible de se connecter au serveur. Mode démo activé.',
            icon: 'fas fa-exclamation-circle'
          });
        });
        
        this.socket.on('newToken', (token) => {
          this.addNotification({
            type: 'info',
            title: 'Nouveau Token Détecté',
            message: `${token.name} (${token.symbol}) a été créé`,
            icon: 'fas fa-bell'
          });
        });

        this.socket.on('error', (error) => {
          this.addNotification({
            type: 'error',
            title: 'Erreur',
            message: error.message,
            icon: 'fas fa-exclamation-circle'
          });
        });
      } catch (error) {
        console.error('Erreur lors de l\'initialisation de Socket.IO:', error);
      }
    },
    addDebugNotification() {
      // Ajouter une notification de démo après 2 secondes
      setTimeout(() => {
        this.addNotification({
          type: 'info',
          title: 'Mode Démo',
          message: 'Les données affichées sont des exemples pour démonstration',
          icon: 'fas fa-info-circle'
        });
      }, 2000);
    },
    addNotification(notification) {
      const newNotification = {
        ...notification,
        progress: 100,
        id: Date.now()
      };
      
      this.notifications.push(newNotification);
      
      const interval = setInterval(() => {
        const index = this.notifications.findIndex(n => n.id === newNotification.id);
        if (index !== -1) {
          this.notifications[index].progress -= 1;
          if (this.notifications[index].progress <= 0) {
            this.removeNotification(index);
            clearInterval(interval);
          }
        } else {
          clearInterval(interval);
        }
      }, 50);
    },
    removeNotification(index) {
      this.notifications.splice(index, 1);
    },
    closeWelcome() {
      this.showWelcome = false;
    }
  },
  beforeUnmount() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
};
</script>

<style scoped>
.notifications-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.notification {
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.notification:hover {
  transform: translateX(-5px);
}

.notification-content {
  display: flex;
  align-items: center;
  padding: 15px;
}

.notification-content i {
  font-size: 20px;
  margin-right: 15px;
}

.notification-message {
  flex: 1;
}

.notification-message strong {
  display: block;
  margin-bottom: 5px;
}

.notification-progress {
  height: 3px;
  background: #007bff;
  transition: width 0.05s linear;
}

.notification.info {
  border-left: 4px solid #007bff;
}

.notification.error {
  border-left: 4px solid #dc3545;
}

.notification.info i {
  color: #007bff;
}

.notification.error i {
  color: #dc3545;
}

.welcome-message {
  margin-bottom: 20px;
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
