import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true })

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 15000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://cb_user:cb_password@127.0.0.1:5432/cb_crm',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})

