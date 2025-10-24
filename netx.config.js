/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // health
      { source: '/api/db-health', destination: '/api/ok' },

      // lectura de velas (usa tu /api/history)
      // ejemplo: /api/candles?ticker=BAUMXP&tf=1m&limit=10
      // pasa query string intacto a /api/history
      { source: '/api/candles', destination: '/api/history' },

      // captura de velas (usa /api/price con flags)
      // ejemplo: /api/candles/capture?ticker=BAUMXP&tf=1m
      { source: '/api/candles/capture', destination: '/api/price?silent=1&capture=1' },

      // carga masiva opcional
      { source: '/api/candles/bulk', destination: '/api/price?silent=1&bulk=1' },
    ];
  },
};

module.exports = nextConfig;
