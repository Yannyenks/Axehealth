import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

// Les tests d'intégration tournent contre TEST_DATABASE_URL (une base
// dédiée, jamais la base de développement/démo) — voir .env.example et
// services/*.test.ts. DATABASE_URL est réécrite ici, avant que
// lib/prisma.ts ne soit importé par un test, pour que le client Prisma se
// connecte à la bonne base.
dotenv.config();
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    globals: true,
    testTimeout: 15000,
  },
});
