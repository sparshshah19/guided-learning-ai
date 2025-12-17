import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// Simple Vite config with no custom API routes.
export default defineConfig({
  plugins: [react()],
})
