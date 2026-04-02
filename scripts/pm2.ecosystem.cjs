/**
 * PM2: наш дневник на hoster (порт 3002 — 3000/3001 часто заняты).
 * Запуск из каталога репозитория:
 *   pm2 start scripts/pm2.ecosystem.cjs
 * Next.js подхватит `.env` из cwd (DATABASE_URL, NEXTAUTH_* и т.д.).
 */
const path = require("path");
const root = path.join(__dirname, "..");

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
