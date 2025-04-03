const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: '/',
  productionSourceMap: false,
  configureWebpack: {
    output: {
      filename: '[name].[hash].js'
    }
  },
  chainWebpack: config => {
    config.plugin('copy')
      .tap(args => {
        args[0].push({
          from: 'netlify.toml',
          to: './'
        });
        args[0].push({
          from: '_redirects',
          to: './'
        });
        return args;
      });
  }
})
