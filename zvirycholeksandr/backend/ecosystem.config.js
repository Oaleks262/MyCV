module.exports = {
  apps: [{
    name: 'zvirycholeksandr',
    script: 'src/index.js',
    cwd: './backend',
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 1995
    }
  }]
};
