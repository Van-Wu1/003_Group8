import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',               // 开发目录
  base: '/0003GW/',
  build: {
    outDir: '../docs',
    emptyOutDir: true
  }
})
