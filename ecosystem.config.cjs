module.exports = {
  apps: [
    {
      name: 'mock-openai',
      script: 'dist/index.js',
      instances: 4,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
