import { createRouter, createWebHistory } from 'vue-router';
import TokenList from '../components/TokenList.vue';
import TokenDetails from '../components/TokenDetails.vue';
import AddTokenForm from '../components/AddTokenForm.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: TokenList
  },
  {
    path: '/token/:address',
    name: 'TokenDetails',
    component: TokenDetails,
    props: true
  },
  {
    path: '/add-token',
    name: 'AddToken',
    component: AddTokenForm
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router; 