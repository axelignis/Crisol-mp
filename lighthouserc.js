module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/es/catalogo'],
      startServerCommand: 'npm run build && npm run start',
    },
    assert: {
      assertions: {
        'categories:performance':        ['error', { minScore: 0.9 }],
        'categories:seo':                ['error', { minScore: 0.95 }],
        'categories:accessibility':      ['warn',  { minScore: 0.9 }],
        'largest-contentful-paint':      ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift':       ['error', { maxNumericValue: 0.1 }],
        'interaction-to-next-paint':     ['error', { maxNumericValue: 200 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
}
