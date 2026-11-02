import express from 'express';
import path from 'node:path';
import { loadConfig } from './env';
import type { ProjectPlan } from '../shared/types';
import { createOpenAICompatible } from './infra/llm/openai-compatible';
import { NodeSandboxRunner } from './infra/runner';
import { createPersistentStore } from './infra/store';
import { PlanService } from './domain/plan';
import { TutorService, type StoredSession } from './domain/tutor';
import { createApiRouter } from './api/app';
import { mountProduction, mountViteDev } from './web-host';

const config = loadConfig();

// ---- 依赖装配：全部通过构造函数注入，方便替换与测试 ----
const store = createPersistentStore<StoredSession>(path.resolve('data', 'sessions.db'));
const planCache = createPersistentStore<ProjectPlan>(path.resolve('data', 'plans.db'));
const llm = createOpenAICompatible(config.llm);
const runner = new NodeSandboxRunner(config.pythonBin);
const planService = new PlanService(llm, runner, planCache);
const tutor = new TutorService({ plan: planService, llm, store, runner });

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api', createApiRouter(tutor));

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  mountProduction(app);
} else {
  await mountViteDev(app);
}

app.listen(config.port, () => {
  const mode = config.llm.enabled ? `LLM 模式（${config.llm.model}）` : '离线演示模式（未配置 LLM_API_KEY）';
  console.log(`[code-mentor] 服务已启动: http://localhost:${config.port}  |  ${mode}`);
});
