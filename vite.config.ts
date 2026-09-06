import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error The SQLite Vite middleware is intentionally plain Node ESM.
import { casinoSqlitePlugin } from './server/casino-sqlite.mjs'
// @ts-expect-error Static delivery helpers are intentionally plain Node ESM.
import { staticAssetOptimizerPlugin, versionStaticAssetsPlugin } from './server/static-asset-optimizer.mjs'

export default defineConfig({
  plugins: [
    versionStaticAssetsPlugin(),
    react(),
    casinoSqlitePlugin(process.env.PEHLEVAN_DB_DIRECTORY ? { databasePath: process.env.PEHLEVAN_DB_DIRECTORY } : {}),
    staticAssetOptimizerPlugin(),
  ],
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
