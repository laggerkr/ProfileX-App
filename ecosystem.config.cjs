module.exports = {
  apps: [{
    name: "profilex-api",
    cwd: __dirname,
    script: "apps/backend/dist/index.js",
    env: { NODE_ENV: "production", PORT: 4387 }
  }]
};
