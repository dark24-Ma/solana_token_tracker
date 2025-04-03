<template>
  <div class="app-container dark-mode">
    <!-- Navbar -->
    <nav class="navbar navbar-expand-lg">
      <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center" href="#">
          <img src="@/assets/solana-logo.png" alt="Solana Logo" class="solana-logo me-2" />
          <span>Solana <span class="text-primary">Tracker</span></span>
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto">
            <li class="nav-item">
              <a class="nav-link active" aria-current="page" href="#">
                <i class="fas fa-home me-1"></i> Accueil
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="https://solscan.io" target="_blank">
                <i class="fas fa-search me-1"></i> Explorer
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="https://solana.com" target="_blank">
                <i class="fas fa-external-link-alt me-1"></i> Solana
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- Footer -->
    <footer class="footer py-3 mt-auto">
      <div class="container text-center">
        <span class="footer-text">
          <i class="fas fa-code me-1"></i> Solana Token Tracker &copy; {{ currentYear }}
        </span>
      </div>
    </footer>

    <!-- Notifications -->
    <div class="notifications-container">
      <div 
        v-for="(notification, index) in notifications" 
        :key="index" 
        class="notification-item"
        :class="[notification.type, { 'with-actions': !notification.autoClose }]"
        @click="notification.data ? viewTokenDetails(notification) : removeNotification(index)"
      >
        <div class="notification-icon">
          <i :class="getNotificationIcon(notification.type)"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">{{ notification.title }}</div>
          <div class="notification-message">{{ notification.message }}</div>
        </div>
        <div v-if="notification.data" class="notification-actions">
          <button class="btn btn-sm btn-link" @click.stop="viewTokenDetails(notification)">
            <i class="fas fa-external-link-alt"></i>
          </button>
          <button class="btn btn-sm btn-link" @click.stop="removeNotification(index)">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div v-else-if="!notification.autoClose" class="notification-actions">
          <button class="btn btn-sm btn-link" @click.stop="removeNotification(index)">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="notification-progress" v-if="notification.autoClose">
          <div class="progress-bar" :style="{ width: notification.progress + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import io from 'socket.io-client';
import { playNotificationSound, playNewTokenSound } from './utils/notification';

export default {
  name: 'App',
  setup() {
    const socket = ref(null);
    const notifications = ref([]);
    
    const currentYear = computed(() => new Date().getFullYear());
    
    // Connecter au serveur Socket.io
    const connectSocket = () => {
      socket.value = io(process.env.VUE_APP_BACKEND_URL || 'http://localhost:3000');
      
      socket.value.on('connect', () => {
        console.log('Socket.io connecté au serveur depuis App.vue');
        playNotificationSound('success');
      });
      
      socket.value.on('newToken', (token) => {
        // Notification plus détaillée
        const tokenPrice = formatPrice(token.price);
        addNotification({
          type: 'success',
          title: 'Nouveau Token Détecté',
          message: `${token.name} (${token.symbol}) - ${tokenPrice}`,
          autoClose: false, // Ne pas fermer automatiquement
          data: token // Stocker les données du token
        });
        
        // Jouer un son de notification
        playNewTokenSound();
      });
      
      socket.value.on('error', (errorMsg) => {
        addNotification({
          type: 'error',
          title: 'Erreur',
          message: errorMsg
        });
        
        // Jouer un son d'erreur
        playNotificationSound('error');
      });
    };
    
    // Format monétaire
    const formatPrice = (price) => {
      if (!price || isNaN(price) || price === 0) return '$0.00';
      
      // Formatter les petits prix avec plus de décimales
      if (price < 0.01) {
        return `$${price.toFixed(8)}`;
      } else if (price < 1) {
        return `$${price.toFixed(4)}`;
      } else {
        return `$${price.toLocaleString('fr-FR', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`;
      }
    };
    
    // Ajouter une notification
    const addNotification = (notification) => {
      const newNotification = {
        ...notification,
        progress: 100,
        id: Date.now(),
        autoClose: notification.autoClose !== false // Par défaut, fermer automatiquement
      };
      
      notifications.value.push(newNotification);
      
      // Si autoClose est true, faire diminuer la barre et fermer automatiquement
      if (newNotification.autoClose) {
        const intervalId = setInterval(() => {
          const notificationIndex = notifications.value.findIndex(n => n.id === newNotification.id);
          
          if (notificationIndex !== -1) {
            notifications.value[notificationIndex].progress -= 1;
            
            if (notifications.value[notificationIndex].progress <= 0) {
              clearInterval(intervalId);
              notifications.value.splice(notificationIndex, 1);
            }
          } else {
            clearInterval(intervalId);
          }
        }, 75); // Durée totale: environ 7.5 secondes
      }
    };
    
    // Supprimer une notification
    const removeNotification = (index) => {
      notifications.value.splice(index, 1);
    };
    
    // Voir les détails du token
    const viewTokenDetails = (notification) => {
      if (notification.data) {
        // Rediriger vers Solscan pour voir les détails du token
        window.open(`https://solscan.io/token/${notification.data.mint}`, '_blank');
      }
      
      // Supprimer la notification après l'avoir cliquée
      const index = notifications.value.findIndex(n => n.id === notification.id);
      if (index !== -1) {
        removeNotification(index);
      }
    };
    
    // Obtenir l'icône correspondant au type de notification
    const getNotificationIcon = (type) => {
      switch (type) {
        case 'success':
          return 'fas fa-check-circle';
        case 'error':
          return 'fas fa-exclamation-circle';
        case 'warning':
          return 'fas fa-exclamation-triangle';
        case 'info':
        default:
          return 'fas fa-info-circle';
      }
    };
    
    // Cycle de vie du composant
    onMounted(() => {
      connectSocket();
      
      // Notification de bienvenue
      setTimeout(() => {
        addNotification({
          type: 'info',
          title: 'Bienvenue',
          message: 'Surveillez en temps réel les nouveaux tokens Solana'
        });
      }, 1000);
      
      // Charger la police Poppins
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap';
      document.head.appendChild(link);
    });
    
    onBeforeUnmount(() => {
      if (socket.value) {
        socket.value.disconnect();
      }
    });
    
    return {
      notifications,
      currentYear,
      removeNotification,
      getNotificationIcon,
      addNotification,
      viewTokenDetails
    };
  }
};
</script>

<style>
/* Import Google Font - Poppins */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

/* Global Styles */
:root {
  /* Dark Mode Colors */
  --primary-color: #9945FF;
  --primary-light: #C198FB;
  --primary-dark: #7B3FE4;
  --secondary-color: #14F195;
  --success-color: #14F195;
  --warning-color: #FF9900;
  --danger-color: #FF4C4C;
  --info-color: #00C2FF;
  
  /* Dark Mode Background */
  --bg-dark: #131418;
  --bg-card: #1E1E24;
  --bg-hover: #2A2A35;
  
  /* Text Colors */
  --text-primary: #F8F9FA;
  --text-secondary: #CED4DA;
  --text-muted: #868E96;
  --text-bright: #FFFFFF;
  --text-highlight: #14F195;
  
  /* Border Colors */
  --border-color: #2A2A35;
}

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-dark);
  color: var(--text-primary);
  transition: all 0.3s ease;
}

#app {
  font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  height: 100%;
  letter-spacing: 0.3px;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.dark-mode {
  background-color: var(--bg-dark);
  color: var(--text-primary);
}

.main-content {
  flex: 1;
  padding: 0;
  background-color: var(--bg-dark);
}

/* Navbar Styling */
.navbar {
  background-color: rgba(30, 30, 36, 0.95) !important;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border-bottom: 1px solid var(--border-color);
  padding: 0.75rem 1rem;
}

.solana-logo {
  height: 32px;
  width: auto;
  filter: drop-shadow(0 0 5px rgba(153, 69, 255, 0.5));
}

.navbar-brand {
  font-weight: 700;
  font-size: 1.4rem;
  color: var(--text-bright) !important;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.navbar-brand span.text-primary {
  color: var(--primary-color) !important;
  font-weight: 800;
  text-shadow: 0 0 10px rgba(153, 69, 255, 0.3);
}

.nav-link {
  font-weight: 500;
  color: var(--text-secondary) !important;
  margin: 0 0.25rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.nav-link:hover, .nav-link.active {
  color: var(--text-bright) !important;
  background-color: var(--bg-hover);
}

/* Footer Styling */
.footer {
  background-color: var(--bg-card);
  border-top: 1px solid var(--border-color);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
}

.footer-text {
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 400;
}

/* Notification Styling */
.notifications-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  width: 320px;
  max-width: 90vw;
}

.notification-item {
  display: flex;
  margin-bottom: 12px;
  padding: 16px;
  border-radius: 12px;
  background-color: var(--bg-card);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  animation: slideIn 0.3s ease-out forwards;
  max-width: 400px;
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.notification-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
  border-color: var(--primary-color);
}

.notification-item.with-actions {
  padding-right: 60px;
}

.notification-actions {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
}

.notification-actions .btn {
  padding: 3px 5px;
  color: var(--text-secondary);
  margin: 2px 0;
  transition: all 0.2s ease;
}

.notification-actions .btn:hover {
  color: var(--primary-light);
}

.notification-item.success {
  border-left: 4px solid var(--success-color);
}

.notification-item.error {
  border-left: 4px solid var(--danger-color);
}

.notification-item.warning {
  border-left: 4px solid var(--warning-color);
}

.notification-item.info {
  border-left: 4px solid var(--info-color);
}

.notification-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  font-size: 1.25rem;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  padding: 6px;
}

.notification-item.success .notification-icon {
  color: var(--success-color);
  background-color: rgba(20, 241, 149, 0.1);
}

.notification-item.error .notification-icon {
  color: var(--danger-color);
  background-color: rgba(255, 76, 76, 0.1);
}

.notification-item.warning .notification-icon {
  color: var(--warning-color);
  background-color: rgba(255, 153, 0, 0.1);
}

.notification-item.info .notification-icon {
  color: var(--info-color);
  background-color: rgba(0, 194, 255, 0.1);
}

.notification-content {
  flex-grow: 1;
}

.notification-title {
  font-weight: 600;
  margin-bottom: 5px;
  font-size: 0.95rem;
  color: var(--text-bright);
  letter-spacing: 0.3px;
}

.notification-message {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.notification-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background-color: rgba(255, 255, 255, 0.1);
}

.notification-progress .progress-bar {
  height: 100%;
  transition: width 0.1s linear;
}

.notification-item.success .progress-bar {
  background-color: var(--success-color);
}

.notification-item.error .progress-bar {
  background-color: var(--danger-color);
}

.notification-item.warning .progress-bar {
  background-color: var(--warning-color);
}

.notification-item.info .progress-bar {
  background-color: var(--info-color);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Card Styling */
.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  overflow: hidden;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
}

.card-header {
  background-color: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem 1.25rem;
  color: var(--text-bright);
  font-weight: 600;
}

.card-body {
  padding: 1.25rem;
}

.card-title {
  color: var(--text-bright);
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.card-text {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.5;
}

/* Button Styling */
.btn {
  font-weight: 500;
  border-radius: 8px;
  padding: 0.5rem 1.25rem;
  transition: all 0.3s ease;
  font-family: 'Poppins', sans-serif;
}

.btn-primary {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  box-shadow: 0 4px 10px rgba(153, 69, 255, 0.3);
  color: var(--text-bright);
}

.btn-primary:hover, .btn-primary:focus {
  background-color: var(--primary-dark);
  border-color: var(--primary-dark);
  box-shadow: 0 6px 15px rgba(153, 69, 255, 0.4);
  transform: translateY(-2px);
  color: var(--text-bright);
}

.btn-outline-primary {
  color: var(--primary-light);
  border-color: var(--primary-color);
}

.btn-outline-primary:hover, .btn-outline-primary:focus {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  box-shadow: 0 4px 10px rgba(153, 69, 255, 0.3);
  color: var(--text-bright);
}

.btn-sm {
  font-size: 0.85rem;
  padding: 0.25rem 0.75rem;
}

/* Text Colors */
.text-primary {
  color: var(--primary-color) !important;
}

.text-success {
  color: var(--success-color) !important;
}

.text-warning {
  color: var(--warning-color) !important;
}

.text-danger {
  color: var(--danger-color) !important;
}

.text-info {
  color: var(--info-color) !important;
}

.text-muted {
  color: var(--text-muted) !important;
}

.text-bright {
  color: var(--text-bright) !important;
}

.text-highlight {
  color: var(--text-highlight) !important;
}

/* Background Colors */
.bg-primary {
  background-color: var(--primary-color) !important;
}

.bg-dark {
  background-color: var(--bg-dark) !important;
}

/* Media Queries */
@media (max-width: 767.98px) {
  .notifications-container {
    width: calc(100vw - 40px);
    right: 20px;
  }
  
  .navbar-brand {
    font-size: 1.2rem;
  }
  
  .navbar {
    padding: 0.6rem 0.75rem;
  }
  
  .solana-logo {
    height: 26px;
  }
}

/* Custom Badge */
.badge {
  font-weight: 500;
  border-radius: 6px;
  padding: 0.35em 0.65em;
  font-size: 0.75em;
}

.badge.bg-success {
  background-color: rgba(20, 241, 149, 0.15) !important;
  color: var(--success-color);
  border: 1px solid rgba(20, 241, 149, 0.3);
}

.badge.bg-primary {
  background-color: rgba(153, 69, 255, 0.15) !important;
  color: var(--primary-light);
  border: 1px solid rgba(153, 69, 255, 0.3);
}

.badge.bg-warning {
  background-color: rgba(255, 153, 0, 0.15) !important;
  color: var(--warning-color);
  border: 1px solid rgba(255, 153, 0, 0.3);
}

.badge.bg-danger {
  background-color: rgba(255, 76, 76, 0.15) !important;
  color: var(--danger-color);
  border: 1px solid rgba(255, 76, 76, 0.3);
}

/* Custom Form Controls */
.form-control, .form-select {
  background-color: var(--bg-hover);
  border: 1px solid var(--border-color);
  color: var(--text-bright);
  border-radius: 8px;
  padding: 0.6rem 1rem;
  transition: all 0.3s ease;
}

.form-control::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.form-control:focus, .form-select:focus {
  background-color: var(--bg-hover);
  color: var(--text-bright);
  border-color: var(--primary-color);
  box-shadow: 0 0 0 0.25rem rgba(153, 69, 255, 0.25);
}

.input-group-text {
  background-color: var(--bg-hover);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 8px;
}

/* Custom Table */
.table {
  color: var(--text-secondary);
}

.table th {
  color: var(--text-primary);
  font-weight: 600;
  border-bottom-color: var(--border-color);
}

.table td {
  border-color: var(--border-color);
}

.table-hover tbody tr:hover {
  background-color: var(--bg-hover);
  color: var(--text-bright);
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-dark);
}

::-webkit-scrollbar-thumb {
  background-color: var(--border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--primary-color);
}

/* Links */
a {
  color: var(--primary-light);
  text-decoration: none;
  transition: all 0.2s ease;
}

a:hover {
  color: var(--primary-color);
  text-decoration: none;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
  color: var(--text-bright);
  font-weight: 600;
  letter-spacing: 0.5px;
}
</style>
