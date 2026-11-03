import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 前端构建配置。开发时前端由 Express 内的 Vite 中间件托管（见 src/server/web-host.ts），
// `vite build` 只负责生成 dist/web 的静态产物。
//
// watch.ignored 说明：本项目在受限沙箱下开发时，文件写入会产生临时文件
// （如 *.tmp / *.tmpdir 目录），SQLite 也会写 data/ 目录；这些都会干扰
// chokidar 监视器甚至导致 EBUSY 崩溃，因此统一忽略。
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/*.tmp',
        '**/*.tmpdir/**',
        '**/.*.tmpdir/**',
        '**/data/**',
        '**/*.db',
        '**/*.db-*',
        '**/*.mp4',
        '**/*.webm',
        '**/*.mov',
        '**/*.pptx',
        '**/*.pdf',
      ],
    },
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
});
