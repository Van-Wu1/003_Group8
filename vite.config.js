import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  base: './',
  // 告诉 Vite：publicDir 在 src 的上一级目录下的 public
  publicDir: '../public',
  build: {
    outDir: '../docs',
    emptyOutDir: true
  }
})
