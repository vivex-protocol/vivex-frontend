const path = require('path');
module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@vivex-xyz': path.resolve(__dirname, 'src/vivex-xyz'),
    },
  },
};