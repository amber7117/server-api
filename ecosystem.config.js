module.exports = {
  apps: [
    {
      name: "server-api",
      script: "./dist/index.js",
      env: {
        NODE_ENV: "production"
      },
    },
  ],
};
