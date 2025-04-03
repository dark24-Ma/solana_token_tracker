<template>
  <div class="token-chart">
    <Line
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script>
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export default {
  name: 'TokenChart',
  components: { Line },
  props: {
    priceHistory: {
      type: Array,
      required: true
    }
  },
  computed: {
    chartData() {
      return {
        labels: this.priceHistory.map(item => new Date(item.timestamp).toLocaleTimeString()),
        datasets: [
          {
            label: 'Prix ($)',
            data: this.priceHistory.map(item => item.price),
            borderColor: '#42b983',
            tension: 0.1
          }
        ]
      }
    },
    chartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Évolution du prix'
          }
        }
      }
    }
  }
}
</script>

<style scoped>
.token-chart {
  height: 300px;
  margin: 20px 0;
}
</style> 