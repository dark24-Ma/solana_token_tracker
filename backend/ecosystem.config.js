module.exports = {
  apps: [
    {
      name: 'solana-token-tracker-api',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 6607
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 6607
      },
      time: true
    }
  ]
}; 