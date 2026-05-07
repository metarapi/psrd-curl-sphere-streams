import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => {
  const base = command === 'build' ? '/psrd-curl-sphere-streams/' : '/'

  return {
    base,
    plugins: [tailwindcss()],
    build: {
      outDir: 'dist',
    }
  }
})