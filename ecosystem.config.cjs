/**
 * PM2 (hoster): порт 3002 по умолчанию.
 *   pm2 start ecosystem.config.cjs
 * Next.js читает `.env` из cwd репозитория.
 */
const path = require("path");
const root = __dirname;

module.exports = {
  apps: [
    {
      name: "ourdiary",
      cwd: root,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: process.env.OURDIARY_PORT || "3002",
      },
    },
  ],
};
