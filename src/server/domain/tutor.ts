import type {
  ActivitySnapshot,
  ChatTurn,
  HintLevel,
  HintOutcome,
  RunResult,
  SessionState,
  TaskNode,
} from '../../shared/types';
import { AUTO_HINT_MAX_LEVEL, LEVEL_BEHAVIOR, escalate } from '../../shared/hint-ladder';
import type { ChatMessage, LLMProvider } from '../infra/llm/provider';
import type { CodeRunner } from '../infra/runner';
import type { KeyValueStore } from '../infra/store';
import { HttpError } from '../errors';
import type { PlanService } from './plan';
import { evaluateStall } from './stall';

interface LadderState {
  /** 当前已给出的最高提示等级（0 表示还没提示过） */
  level: number;
  /** 提示次数，用于轮换离线提示库里的备选问句 */
  hintCount: number;
  lastHintAt: number | null;
}

export interface StoredSession {
  id: string;
  goal: string;
  createdAt: number;
  plan: import('../../shared/types').ProjectPlan;
  currentTaskIndex: number;
  completedTaskIds: string[];
  chat: ChatTurn[];
  ladder: LadderState;
  activity: ActivitySnapshot | null;
}

export interface TutorDeps {
  plan: PlanService;
  llm: LLMProvider;
  store: KeyValueStore<StoredSession>;
  runner: CodeRunner;
}

/** 历史学习列表里的会话摘要 */
export interface SessionSummary {
  id: string;
  goal: string;
  title: string;
  currentTaskIndex: number;
  totalTasks: number;
  completedCount: number;
  createdAt: number;
  updatedAt: number;
  finished: boolean;
}

/** 知识库卡片：每完成一个步骤沉淀一条 */
export interface KnowledgeCard {
  id: string;
  project: string;
  title: string;
  summary: string;
  sessionId: string;
  at: number;
}

/** 自动提示的最小间隔（防止每 8 秒上报就刷一条提示） */
const AUTO_HINT_COOLDOWN_MS = 60_000;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n…（已截断）`;
}

export class TutorService {
  constructor(private readonly deps: TutorDeps) {}

  get llmEnabled(): boolean {
    return this.deps.llm.enabled;
  }

  get modelName(): string | null {
    return this.deps.llm.model ?? null;
  }

  /** 历史学习列表（最近更新在前） */
  listSessions(limit = 20): SessionSummary[] {
    return this.deps.store
      .all()
      .map(({ id, value: session, updatedAt }) => ({
        id,
        goal: session.goal,
        title: session.plan.title,
        currentTaskIndex: session.currentTaskIndex,
        totalTasks: session.plan.tasks.length,
        completedCount: session.completedTaskIds.length,
        createdAt: session.createdAt,
        updatedAt: updatedAt || session.createdAt,
        finished: session.currentTaskIndex >= session.plan.tasks.length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  /** 知识库：把每个「已完成步骤」沉淀成知识卡片（标题 + 一句话摘要） */
  listKnowledge(limit = 100): KnowledgeCard[] {
    const cards: KnowledgeCard[] = [];
    for (const { value: session, updatedAt } of this.deps.store.all()) {
      for (const taskId of session.completedTaskIds) {
        const task = session.plan.tasks.find((item) => item.id === taskId);
        if (!task) continue;
        cards.push({
          id: `${session.id}:${task.id}`,
          project: session.plan.title,
          title: task.title,
          summary: task.explain || task.goal,
          sessionId: session.id,
          at: updatedAt || session.createdAt,
        });
      }
    }
    return cards.sort((a, b) => b.at - a.at).slice(0, limit);
  }

  /* ---------------- 会话生命周期 ---------------- */

  async createSession(goal: string): Promise<SessionState> {
    const trimmed = goal.trim();
    if (trimmed.length < 4) {
      throw new HttpError(400, '请先用一句话描述你想写的项目或想掌握的内容');
    }
    const plan = await this.deps.plan.generate(trimmed);
    const session: StoredSession = {
      id: crypto.randomUUID(),
      goal: trimmed,
      createdAt: Date.now(),
      plan,
      currentTaskIndex: 0,
      completedTaskIds: [],
      chat: [],
      ladder: { level: 0, hintCount: 0, lastHintAt: null },
      activity: null,
    };
    // 导师开场：欢迎 + 第一步的清晰指令（不堆砌）
    const firstTask = plan.tasks[0];
    if (firstTask) {
      session.chat.push({
        role: 'tutor',
        content: `欢迎来到「桃花源码」🌸 今天做：${plan.title}\n\n第一步 · ${firstTask.title}\n${firstTask.brief}`,
        at: Date.now(),
        level: null,
      });
    }
    this.persist(session);
    return this.toPublic(session);
  }

  getSessionState(id: string): SessionState {
    return this.toPublic(this.mustGet(id));
  }

  /* ---------------- 导师对话（非流式，兼容旧接口/冒烟测试） ---------------- */

  async chat(id: string, message: string, code: string): Promise<{ reply: string; session: SessionState }> {
    const session = this.mustGet(id);
    const trimmed = message.trim();
    if (!trimmed) throw new HttpError(400, '消息不能为空');
    const task = this.currentTask(session);
    const history = session.chat.slice();
    session.chat.push({ role: 'student', content: trimmed, at: Date.now() });

    let reply: string | null = null;
    const messages = this.buildChatMessages(session, task, trimmed, code, history);
    if (messages) reply = await this.deps.llm.chat(messages, { temperature: 0.6, maxTokens: 600 });
    if (!reply) reply = this.offlineReply(session, task, trimmed, code);

    session.chat.push({ role: 'tutor', content: reply, at: Date.now(), level: null });
    this.persist(session);
    return { reply, session: this.toPublic(session) };
  }

  /* ---------------- 导师对话（流式：前端打字机效果） ---------------- */

  async chatStream(
    id: string,
    message: string,
    code: string,
    onDelta: (text: string) => void,
  ): Promise<SessionState> {
    const session = this.mustGet(id);
    const trimmed = message.trim();
    if (!trimmed) throw new HttpError(400, '消息不能为空');
    const task = this.currentTask(session);
    const history = session.chat.slice();
    session.chat.push({ role: 'student', content: trimmed, at: Date.now() });

    let full: string | null = null;
    const messages = this.buildChatMessages(session, task, trimmed, code, history);
    if (messages) {
      full = await this.deps.llm.chatStream(messages, { temperature: 0.6, maxTokens: 800 }, onDelta);
    }
    if (!full) {
      const fallback = this.offlineReply(session, task, trimmed, code);
      full = fallback;
      onDelta(fallback);
    }

    session.chat.push({ role: 'tutor', content: full, at: Date.now(), level: null });
    this.persist(session);
    return this.toPublic(session);
  }

  /* ---------------- 卡壳检测 + 提示阶梯 ---------------- */

  async requestHint(
    id: string,
    input: { taskId: string; code: string; activity?: ActivitySnapshot | null; manual: boolean },
  ): Promise<HintOutcome> {
    const session = this.mustGet(id);
    const task = this.taskById(session, input.taskId);
    if (session.plan.tasks[session.currentTaskIndex]?.id !== task.id) {
      throw new HttpError(400, '只能对当前进行中的步骤请求提示');
    }
    if (input.activity) {
      session.activity = { ...input.activity, taskId: task.id, updatedAt: Date.now() };
    }
    const signal = evaluateStall(session.activity);
    const now = Date.now();

    if (!input.manual) {
      if (!signal.stalled) return { stalled: false, level: null, hint: null };
      if (session.ladder.lastHintAt && now - session.ladder.lastHintAt < AUTO_HINT_COOLDOWN_MS) {
        return { stalled: true, level: null, hint: null };
      }
    }

    const level = escalate(session.ladder.level);
    session.ladder.level = level;
    session.ladder.hintCount += 1;
    session.ladder.lastHintAt = now;
    const hint = await this.generateHint(session, task, level, input.code, signal.reasons);
    session.chat.push({ role: 'tutor', content: hint, at: now, level });
    this.persist(session);
    return { stalled: signal.stalled, level, hint };
  }

  /* ---------------- 代码运行与验收 ---------------- */

  async run(id: string, taskId: string, code: string): Promise<{ result: RunResult }> {
    const session = this.mustGet(id);
    const task = this.taskById(session, taskId);
    const result = await this.deps.runner.run(code, task.language);
    return { result };
  }

  async complete(
    id: string,
    taskId: string,
    code: string,
  ): Promise<{ passed: boolean; reason: string; session: SessionState }> {
    const session = this.mustGet(id);
    const task = this.taskById(session, taskId);
    const index = session.plan.tasks.findIndex((item) => item.id === task.id);
    if (index !== session.currentTaskIndex) {
      throw new HttpError(400, '只能提交当前进行中的步骤');
    }

    const run = await this.deps.runner.run(code, task.language);
    let passed = this.evaluateAcceptance(task, run);
    let failReason = '';

    // 防作弊：输出通过后，再用模型审核代码是否真的实现了逻辑（而不是直接打印结果）
    if (passed) {
      const auditPassed = await this.auditSubmission(task, code);
      if (!auditPassed) {
        passed = false;
        failReason =
          '输出对了，但代码看起来只是直接打印了结果，没有实现真正的逻辑。请先实现函数/循环/判断，再提交。';
      }
    }

    if (!passed) {
      const reason =
        failReason ||
        (run.stderr.trim()
          ? `本次运行报错：${run.stderr.trim().split('\n')[0]}`
          : '输出还没有满足验收标准，对照注释里的期望输出再检查一遍。');
      session.chat.push({ role: 'tutor', content: `还没有通过验收：${reason}`, at: Date.now(), level: null });
      this.persist(session);
      return { passed: false, reason, session: this.toPublic(session) };
    }

    session.completedTaskIds.push(task.id);
    const nextIndex = index + 1;
    session.currentTaskIndex = nextIndex;
    session.ladder = { level: 0, hintCount: 0, lastHintAt: null };
    const done = nextIndex >= session.plan.tasks.length;
    const explain = task.explain || `你完成了第 ${index + 1} 步：${task.title}。`;
    const nextTask = session.plan.tasks[nextIndex];
    session.chat.push({
      role: 'tutor',
      content: done
        ? `🎉 ${explain}\n\n全部完成：${session.plan.tasks.map((item) => item.title).join(' → ')}`
        : `✓ ${explain}\n\n下一步 · ${nextTask?.title ?? ''}\n${nextTask?.brief ?? ''}`,
      at: Date.now(),
      level: null,
    });
    this.persist(session);
    return { passed: true, reason: '验收通过', session: this.toPublic(session) };
  }

  /* ---------------- 内部实现：提示生成 ---------------- */

  private async generateHint(
    session: StoredSession,
    task: TaskNode,
    level: HintLevel,
    code: string,
    stallReasons: string[],
  ): Promise<string> {
    if (this.deps.llm.enabled) {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            `你是“编程陪练导师”，学生是大学工科编程初学者，你的目标是让学生独立写出代码。\n` +
            `当前任务：${task.title}\n本步目标：${task.goal}\n学生看到的说明：${task.instructions}\n` +
            `本次提示等级：L${level}——${LEVEL_BEHAVIOR[level]}\n` +
            `学生当前代码：\n\`\`\`${task.language}\n${truncate(code, 4000)}\n\`\`\`\n` +
            `卡壳信号：${stallReasons.join('；') || '（无）'}`,
        },
        { role: 'user', content: `请只输出一条 L${level} 提示正文，不要任何前后缀说明。` },
      ];
      const reply = await this.deps.llm.chat(messages, { temperature: 0.5, maxTokens: 300 });
      if (reply) return reply;
    }
    return this.offlineHint(session, task, level);
  }

  /** 离线兜底：从任务内置提示库按等级取提示，避免依赖任何外部服务。 */
  private offlineHint(session: StoredSession, task: TaskNode, level: HintLevel): string {
    if (level >= 4) {
      return `${task.hints.L4}\n\n参考实现：\n\`\`\`${task.language}\n${task.reference}\n\`\`\``;
    }
    if (level === 3) return task.hints.L3;
    const bank = level === 2 ? task.hints.L2 : task.hints.L1;
    const pick = bank[session.ladder.hintCount % bank.length] ?? bank[0];
    return `【提示 L${level}】${pick}`;
  }

  /* ---------------- 内部实现：对话 ---------------- */

  private buildChatMessages(
    session: StoredSession,
    task: TaskNode,
    message: string,
    code: string,
    history: ChatTurn[],
  ): ChatMessage[] | null {
    if (!this.deps.llm.enabled) return null;
    const system = `你是“编程陪练导师”，学生是大学工科编程初学者，目标是让学生独立写出代码，而不是替学生写。\n规则：\n1. 回答简洁，最多 8 行，用中文；\n2. 苏格拉底式：先反问学生下一步打算怎么做；\n3. 若学生表示卡住，给出 L${Math.min(session.ladder.level + 1, AUTO_HINT_MAX_LEVEL)} 级别的引导（方向→定位→伪代码，逐级升级）；\n4. 除非学生明确说“直接给我完整答案”，否则不输出完整可运行代码；\n5. 当前任务：${task.title}｜目标：${task.goal}\n学生当前代码：\n\`\`\`${task.language}\n${truncate(code, 4000)}\n\`\`\``;
    return [
      { role: 'system', content: system },
      ...history.slice(-8).map((turn) => ({
        role: turn.role === 'student' ? ('user' as const) : ('assistant' as const),
        content: turn.content,
      })),
      { role: 'user', content: message },
    ];
  }

  private offlineReply(session: StoredSession, task: TaskNode, message: string, code: string): string {
    const wantsHelp = /提示|卡|不会|不懂|帮|help|怎么办|思路/i;
    const wantsExplain = /为什么|原理|解释|理解|区别|是什么/i;
    if (wantsHelp.test(message)) {
      const level = escalate(session.ladder.level);
      session.ladder.level = level;
      session.ladder.hintCount += 1;
      return this.offlineHint(session, task, level);
    }
    if (wantsExplain.test(message)) {
      return `本步目标：${task.goal}。先想清楚：输入是什么、输出是什么，再动手。`;
    }
    const empty = code.trim().length === 0;
    return `先说说你的计划：这一步你打算怎么拆？` + (empty ? '（编辑区还是空的，先写第一行。）' : '');
  }

  /* ---------------- 内部实现：验收、审核与工具 ---------------- */

  private evaluateAcceptance(task: TaskNode, run: RunResult): boolean {
    if (!run.ok) return false;
    if (task.acceptance.type === 'exit_zero') return true;
    const expected = task.acceptance.value ?? '';
    return expected.length > 0 && run.stdout.includes(expected);
  }

  /**
   * 防作弊审核：判断学生代码是否真的实现了逻辑，而不是硬编码输出。
   * 只在输出验收通过后调用；模型不可用或审核失败时放行（不阻塞学习）。
   */
  private async auditSubmission(task: TaskNode, code: string): Promise<boolean> {
    if (!this.deps.llm.enabled) return true;
    const verdict = await this.deps.llm.chat(
      [
        { role: 'system', content: '你是编程作业审核员。只输出 PASS 或 FAIL 两个词。' },
        {
          role: 'user',
          content:
            `任务要求：${task.goal}\n任务说明：${task.instructions}\n\n学生代码：\n\`\`\`${task.language}\n${truncate(code, 3000)}\n\`\`\`\n\n` +
            '这段代码是真的实现了任务要求，还是只是把期望输出直接打印/硬编码出来？如果它只是直接打印结果（例如 console.log 一个写死的字符串），输出 FAIL；否则输出 PASS。',
        },
      ],
      { temperature: 0, maxTokens: 8 },
    );
    if (!verdict) return true;
    return !/FAIL/i.test(verdict);
  }

  private persist(session: StoredSession): void {
    this.deps.store.set(session.id, session);
  }

  private mustGet(id: string): StoredSession {
    const session = this.deps.store.get(id);
    if (!session) throw new HttpError(404, '学习会话不存在或已过期');
    return session;
  }

  private currentTask(session: StoredSession): TaskNode {
    const task = session.plan.tasks[session.currentTaskIndex];
    if (!task) throw new HttpError(400, '项目已经全部完成');
    return task;
  }

  private taskById(session: StoredSession, taskId: string): TaskNode {
    const task = session.plan.tasks.find((item) => item.id === taskId);
    if (!task) throw new HttpError(400, '任务不存在，可能项目已经更新');
    return task;
  }

  /** 转成客户端可见状态：剥离所有参考实现（reference 永不离开服务端）。 */
  private toPublic(session: StoredSession): SessionState {
    return {
      id: session.id,
      goal: session.goal,
      plan: {
        title: session.plan.title,
        overview: session.plan.overview,
        language: session.plan.language,
        tasks: session.plan.tasks.map(({ reference: _reference, ...publicTask }) => publicTask),
      },
      currentTaskIndex: session.currentTaskIndex,
      completedTaskIds: [...session.completedTaskIds],
      chat: [...session.chat],
    };
  }
}
