import express, { type NextFunction, type Request, type Response } from 'express';
import type { ActivitySnapshot } from '../../shared/types';
import type { TutorService } from '../domain/tutor';
import { HttpError } from '../errors';
/** 包装 async 处理器：Express 4 不会自动捕获 async 异常，需要手动 next(err)。 */
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
function wrap(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

/** 把客户端上报的活动数据裁剪成安全的最小结构。 */
function parseActivity(raw: unknown, taskId: string): ActivitySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const number = (value: unknown, fallback = 0): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    taskId,
    editsSinceLastReport: number(record.editsSinceLastReport),
    idleMs: number(record.idleMs),
    consecutiveFailedRuns: number(record.consecutiveFailedRuns),
    hasCode: record.hasCode === true,
    updatedAt: Date.now(),
  };
}

export function createApiRouter(tutor: TutorService): express.Router {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', llm: tutor.llmEnabled, model: tutor.modelName });
  });

  /** 历史学习列表 */
  router.get(
    '/sessions',
    wrap(async (_req, res) => {
      res.json({ sessions: tutor.listSessions() });
    }),
  );

  /** 知识库：已完成步骤沉淀的知识卡片 */
  router.get(
    '/knowledge',
    wrap(async (_req, res) => {
      res.json({ cards: tutor.listKnowledge() });
    }),
  );

  router.post(
    '/sessions',
    wrap(async (req, res) => {
      const goal = String((req.body as { goal?: unknown })?.goal ?? '');
      const session = await tutor.createSession(goal);
      res.json({ session });
    }),
  );

  router.get(
    '/sessions/:id',
    wrap(async (req, res) => {
      res.json({ session: tutor.getSessionState(req.params.id) });
    }),
  );

  router.post(
    '/sessions/:id/chat',
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as { message?: unknown; code?: unknown };
      const outcome = await tutor.chat(
        req.params.id,
        String(body.message ?? ''),
        typeof body.code === 'string' ? body.code : '',
      );
      res.json(outcome);
    }),
  );

  /**
   * 流式对话（SSE）：前端边收边渲染，打字机效果。
   * 事件格式：data: {"type":"delta","text":"..."} / {"type":"done","session":{...}} / {"type":"error","message":"..."}
   */
  router.post('/sessions/:id/chat/stream', (req, res) => {
    const body = (req.body ?? {}) as { message?: unknown; code?: unknown };
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (payload: unknown): void => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };
    void (async () => {
      try {
        const session = await tutor.chatStream(
          req.params.id,
          String(body.message ?? ''),
          typeof body.code === 'string' ? body.code : '',
          (text) => send({ type: 'delta', text }),
        );
        send({ type: 'done', session });
      } catch (err) {
        send({ type: 'error', message: err instanceof HttpError ? err.message : '服务器内部错误' });
      } finally {
        res.end();
      }
    })();
  });

  /** 浏览器每 8 秒上报一次编辑活动；服务端判定卡壳并按阶梯返回提示（可能为 null）。 */
  router.post(
    '/sessions/:id/activity',
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as {
        taskId?: unknown;
        code?: unknown;
        activity?: unknown;
      };
      const taskId = String(body.taskId ?? '');
      const outcome = await tutor.requestHint(req.params.id, {
        taskId,
        code: typeof body.code === 'string' ? body.code : '',
        activity: parseActivity(body.activity, taskId),
        manual: false,
      });
      res.json(outcome);
    }),
  );

  /** 学生手动求助（无冷却、直接升一级）。 */
  router.post(
    '/sessions/:id/hint',
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as {
        taskId?: unknown;
        code?: unknown;
        activity?: unknown;
      };
      const taskId = String(body.taskId ?? '');
      const outcome = await tutor.requestHint(req.params.id, {
        taskId,
        code: typeof body.code === 'string' ? body.code : '',
        activity: parseActivity(body.activity, taskId),
        manual: true,
      });
      res.json(outcome);
    }),
  );

  /** 项目完成后继续完善：生成新的教学步骤并追加 */
  router.post(
    '/sessions/:id/extend',
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as { request?: unknown };
      const outcome = await tutor.extendSession(req.params.id, String(body.request ?? ''));
      res.json(outcome);
    }),
  );

  router.post(
    '/sessions/:id/run',
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as { taskId?: unknown; code?: unknown };
      const outcome = await tutor.run(
        req.params.id,
        String(body.taskId ?? ''),
        typeof body.code === 'string' ? body.code : '',
      );
      res.json(outcome);
    }),
  );

  router.post(
    '/sessions/:id/complete',
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as { taskId?: unknown; code?: unknown };
      const outcome = await tutor.complete(
        req.params.id,
        String(body.taskId ?? ''),
        typeof body.code === 'string' ? body.code : '',
      );
      res.json(outcome);
    }),
  );

  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[api] unexpected error:', err);
    res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  });

  return router;
}
