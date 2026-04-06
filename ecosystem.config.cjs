/**
 * PM2 (hoster): порт 3002 по умолчанию.
 *   pm2 start ecosystem.config.cjs
 * Next.js читает `.env` из cwd репозитория.
 * Второй процесс — sidecar чтения QR (см. docs/qr-decode-service.md).
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
    {
      name: "ourdiary-qr-decode",
      cwd: root,
      script: "npm",
      args: "run qr-decode-server",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        QR_DECODE_HOST: "127.0.0.1",
        QR_DECODE_PORT: process.env.QR_DECODE_PORT || "3912",
        QR_DECODE_SECRET: process.env.OURDIARY_QR_DECODE_SECRET || "",
      },
    },
  ],
};
