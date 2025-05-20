import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',               // 开发目录
  base: './',
  build: {
    outDir: '../docs',
    emptyOutDir: true
  }
})
