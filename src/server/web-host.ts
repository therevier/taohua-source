import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const here = path.dirname(fileURLToPath(import.meta.url));

/** 开发模式：把 Vite 挂成 Express 中间件，前端改动热更新、后端改动由 tsx watch 重启。 */
export async function mountViteDev(app: express.Express): Promise<void> {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

/** 生产模式：托管 vite build 产物（dist/web），并回退到 index.html。 */
export function mountProduction(app: express.Express): void {
  const dist = path.resolve(here, '../../dist/web');
  app.use(express.static(dist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}
