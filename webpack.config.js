const path = require('path')
const nodeExternals = require('webpack-node-externals');

module.exports = {
  target: "node",
  entry : {
    index : './src/index.js',
    backup : './src/utils/backup/backup.js'
  },
//  entry: './src/index.js',
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  externals: [nodeExternals()]
}