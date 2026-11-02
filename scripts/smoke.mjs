/**
 * 冒烟测试：对完整链路做端到端检查（支持「AI 在线」与「离线演示」两种模式）。
 *
 * 用法：先启动服务，再运行
 *   node scripts/smoke.mjs
 *
 * 可通过 SMOKE_BASE 指向其他地址（默认 http://localhost:8787）。
 */

const BASE = process.env.SMOKE_BASE || 'http://localhost:8787';
let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.error ?? 'unknown'}`);
  return data;
}

/** 读取流式对话：返回 { deltas, session } */
async function streamChat(sessionId, message, code) {
  const res = await fetch(`${BASE}/api/sessions/${sessionId}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, code }),
  });
  if (!res.ok) throw new Error(`stream chat -> ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const deltas = [];
  let session = null;
  const handleEvent = (raw) => {
    const line = raw.split('\n').find((item) => item.startsWith('data: '));
    if (!line) return;
    const payload = JSON.parse(line.slice(6));
    if (payload.type === 'delta' && payload.text) deltas.push(payload.text);
    else if (payload.type === 'done' && payload.session) session = payload.session;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      handleEvent(buffer.slice(0, index));
      buffer = buffer.slice(index + 2);
    }
  }
  if (buffer.trim()) handleEvent(buffer);
  return { deltas, session };
}

const TODO_SOLUTION = `function addTodo(list, text) {
  const item = { id: list.length + 1, text, done: false };
  list.push(item);
  return item;
}

function listTodos(list) {
  for (const item of list) {
    console.log((item.done ? '[x] ' : '[ ] ') + item.text);
  }
}

const list = [];
addTodo(list, '买牛奶');
addTodo(list, '学 JavaScript');
list[1].done = true;
listTodos(list);
console.log('通过:', list.length === 2 && list[0].text === '买牛奶' && list[1].done === true);
`;

async function main() {
  console.log(`[smoke] 目标服务: ${BASE}`);
  const health = await api('GET', '/api/health');
  const llmMode = health.llm;
  check(health.status === 'ok', '健康检查通过');
  console.log(`[smoke] 当前模式: ${llmMode ? `AI 在线（${health.model}）` : '离线演示'}`);

  const created = await api('POST', '/api/sessions', { goal: '用 JavaScript 写一个待办清单 CLI' });
  const session = created.session;
  check(Array.isArray(session.plan.tasks) && session.plan.tasks.length >= 1, '创建会话并拿到教学计划');
  check(session.currentTaskIndex === 0, '初始进度在第 1 步');
  check(typeof session.plan.overview === 'string', '计划包含项目概览');

  const task = session.plan.tasks[0];
  check(typeof task.skeleton === 'string' && task.skeleton.length > 0, '任务包含起始代码');
  check(!('reference' in task), '参考实现没有泄露给客户端');

  const activity = {
    taskId: task.id,
    editsSinceLastReport: 0,
    idleMs: 120000,
    consecutiveFailedRuns: 0,
    hasCode: false,
  };

  const hint = await api('POST', `/api/sessions/${session.id}/hint`, {
    taskId: task.id,
    code: '',
    activity,
  });
  check(hint.level === 1 && typeof hint.hint === 'string' && hint.hint.length > 0, '手动求助返回 L1 提示');

  const runSkeleton = await api('POST', `/api/sessions/${session.id}/run`, {
    taskId: task.id,
    code: task.skeleton,
  });
  check(typeof runSkeleton.result.stdout === 'string', '起始代码可以运行（结果返回 stdout）');

  const failComplete = await api('POST', `/api/sessions/${session.id}/complete`, {
    taskId: task.id,
    code: task.skeleton,
  });
  if (llmMode) {
    check(typeof failComplete.passed === 'boolean', '提交起始代码有明确验收结果（AI 模式）');
    if (failComplete.passed) console.warn('  ⚠ 起始代码直接通过验收，说明本次生成计划质量偏低');
  } else {
    check(failComplete.passed === false, '未实现时提交不通过验收');
  }

  const chat = await api('POST', `/api/sessions/${session.id}/chat`, {
    message: '我卡住了，不知道怎么开始',
    code: '',
  });
  check(typeof chat.reply === 'string' && chat.reply.length > 0, '导师对话有回复');

  const streamed = await streamChat(session.id, '再给我一点灵感', '');
  check(streamed.deltas.length > 0, '流式对话返回了增量文本');
  check(streamed.session !== null && streamed.session.chat.length >= (session.chat.length + 2), '流式对话完成后会话记录已保存');

  if (!llmMode) {
    const okComplete = await api('POST', `/api/sessions/${session.id}/complete`, {
      taskId: task.id,
      code: TODO_SOLUTION,
    });
    check(okComplete.passed === true, '写对后提交通过验收（离线模板）');
    check(okComplete.session.currentTaskIndex === 1, '通过后自动进入第 2 步');
  }

  console.log(`[smoke] 结果: ${passed} 通过, ${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[smoke] 执行失败:', err.message);
  process.exit(1);
});
