import { createHash } from 'node:crypto';
import type {
  AcceptanceSpec,
  Language,
  ProjectPlan,
  RunResult,
  TaskHints,
  TaskNode,
} from '../../shared/types';
import type { LLMProvider } from '../infra/llm/provider';
import type { CodeRunner } from '../infra/runner';
import type { KeyValueStore } from '../infra/store';
import { buildFallbackPlan } from './fallback-plans';

/** 备课总时间预算：超时直接回退内置模板，避免让用户长时间等待。 */
const PLAN_TIME_BUDGET_MS = 120_000;

function hashGoal(goal: string): string {
  return createHash('sha1').update(goal.trim().toLowerCase()).digest('hex');
}

/**
 * 教学计划服务。
 *
 * 为什么用 XML+CDATA 而不是 JSON：
 * GLM 等模型在 JSON 里写多行代码时经常输出反引号/未转义换行，导致 JSON 不合法；
 * XML + CDATA 能稳定承载任意代码内容，模型遵循度也更高。
 *
 * 质量闸门（关键）：LLM 生成的计划必须通过「实际运行验证」才被采用——
 * 1) 参考实现跑通且满足验收；
 * 2) 起始代码能正常运行；
 * 3) 起始代码不能直接通过验收（防止自测是 console.log('通过: true') 这种假自测）。
 * 不合格自动重试一次，仍不合格则回退内置模板（保证任何情况下都有可用计划）。
 */

const PLAN_XML_SYSTEM_PROMPT = `你是「桃花源码」的编程老师。你要像一位有耐心的老师那样设计项目：把项目分解成清晰的小模块，一步一步带着学生写——先写一块，讲清这一块是什么，再基于它写下一块。

设计原则：
- 项目至少拆成 2 步、最多 3 步「模块步骤」，每一步只引入一个新的小模块（一个函数、一段数据结构、一个判断逻辑），后一步基于前一步的成果继续完善；
- 每步结束学生都能运行看到结果，全程感觉是「一块块把程序搭起来」，而不是零散做题；
- 讲解语言要通俗、具体、口语化，像老师在旁边说话。

运行环境硬性约束（必须遵守）：
- 代码运行在纯 Node 沙箱（JavaScript）或纯 Python 子进程里：单文件脚本，禁止 DOM/HTML/CSS/浏览器 API、禁止 require/import、禁止网络和文件访问、禁止定时器；
- 代码里禁止写讲解性注释，最多一行 TODO 注释（例如 // TODO: 在这里实现 addTodo），所有讲解都放在 brief / explain 标签里。

严格只输出下面这种 XML 格式（不要 markdown 代码块、不要任何解释文字）。为了速度，请写得精简：
<plan>
<title>项目名（简短，突出学什么）</title>
<overview>一两句话说明路线与最终产物</overview>
<language>javascript</language>
<task>
<id>task-1</id>
<title>这一步的名字</title>
<goal>这一步训练什么能力</goal>
<brief>老师在这一步开始时说的话：具体写什么（函数名/要做什么），2 句以内</brief>
<explain>学生写完后老师的讲解：这块在程序里是什么角色、为什么需要它，2 句以内</explain>
<skeleton><![CDATA[
// TODO: 在这里实现……
function add(a, b) {
}

// ===== 自测（不要修改） =====
console.log('通过:', add(2, 3) === 5);
]]></skeleton>
<lang>javascript</lang>
<acceptance_type>output_contains</acceptance_type>
<acceptance_value>通过: true</acceptance_value>
<l1>方向问句，不给定位不给代码</l1>
<l2>定位提示，指出大致位置或概念</l2>
<l3>接口或伪代码，最多 3 行抽象步骤</l3>
<l4>复述要求：要求学生先用自己的话复述，再重写</l4>
<reference><![CDATA[
// 完整参考实现（必须能运行并通过验收）
function add(a, b) {
  return a + b;
}

console.log('通过:', add(2, 3) === 5);
]]></reference>
</task>
</plan>

硬性要求：
1. skeleton 和 reference 必须完整写在 <![CDATA[ ... ]]> 里；reference 必须给出完整可运行代码；
2. skeleton 里的注释只保留一行 TODO 指引，禁止讲解性注释（讲解都写进 brief/explain）；代码末尾保留自测代码，自测用 console.log('通过:', 表达式) 形式，禁止 assert、禁止直接打印恒真值；
3. skeleton 未实现时运行应输出 通过: false 或报错但程序可执行；自测必须是真实断言；acceptance_value 必须是自测通过时才会打印的完整字符串；
4. 任务彼此递进：后一步必须复用前一步写出来的函数/结构，形成「一块块完善」的感觉；
5. 默认语言 javascript；只有需求明确是 Python 时用 python；
6. 单个代码示例不超过 20 行；整体输出尽量精简；
7. acceptance_type 只允许 output_contains（有 acceptance_value 时）或 exit_zero。`;

/* ------------------------------------------------------------------ */
/* XML 解析（宽容解析：容忍 markdown 代码块包裹、缺失的标签）            */
/* ------------------------------------------------------------------ */

function extractTag(text: string, tag: string): string {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = text.match(pattern);
  return match ? match[1] : '';
}

function stripCdata(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (match ? match[1] : trimmed).trim();
}

function cleanText(value: string): string {
  return stripCdata(value).replace(/\r\n/g, '\n').trim();
}

/** 解析修复输出：模型按约定输出两个 fenced 代码块（SKELETON 在前，REFERENCE 在后）。 */
function parseRepairBlocks(raw: string): { skeleton: string; reference: string } | null {
  const fences = [...raw.matchAll(/```[a-z]*\r?\n([\s\S]*?)```/gi)].map((match) => match[1]);
  if (fences.length < 2) return null;
  const clean = (code: string): string => code.replace(/<!--[\s\S]*?-->/g, '').trim();
  const skeleton = clean(fences[0]);
  const reference = clean(fences[1]);
  if (!skeleton || !reference) return null;
  return { skeleton, reference };
}

function parsePlanXml(raw: string): ProjectPlan | null {  // 容错：去掉 markdown 代码块包裹，截取 <plan> 区域
  let text = raw.trim().replace(/^```(?:xml)?\s*/i, '').replace(/```\s*$/i, '');
  const start = text.indexOf('<plan');
  const end = text.lastIndexOf('</plan>');
  if (start < 0 || end <= start) return null;
  text = text.slice(start, end + '</plan>'.length);

  const firstTask = text.search(/<task>/i);
  const header = firstTask < 0 ? text : text.slice(0, firstTask);
  const title = cleanText(extractTag(header, 'title'));
  const overview = cleanText(extractTag(header, 'overview'));
  const planLangText = (extractTag(header, 'language') || extractTag(header, 'lang')).toLowerCase();

  const blocks = [...text.matchAll(/<task>([\s\S]*?)<\/task>/gi)].map((match) => match[1]);
  if (blocks.length === 0 || blocks.length > 6) return null;

  const seenIds = new Set<string>();
  const tasks: TaskNode[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const taskTitle = cleanText(extractTag(block, 'title'));
    const skeleton = stripCdata(extractTag(block, 'skeleton'));
    const reference = stripCdata(extractTag(block, 'reference'));
    if (!taskTitle || !skeleton || !reference) return null;

    let id = cleanText(extractTag(block, 'id')) || `task-${index + 1}`;
    while (seenIds.has(id)) id = `${id}-${index + 1}`;
    seenIds.add(id);

    const taskLangText = (extractTag(block, 'lang') || extractTag(block, 'language')).toLowerCase();
    const language: Language =
      taskLangText === 'python' || planLangText === 'python' ? 'python' : 'javascript';
    const acceptanceType = cleanText(extractTag(block, 'acceptance_type'));
    const acceptanceValue = cleanText(extractTag(block, 'acceptance_value'));
    const acceptance: AcceptanceSpec =
      acceptanceType === 'exit_zero' || !acceptanceValue
        ? { type: 'exit_zero' }
        : { type: 'output_contains', value: acceptanceValue };

    const l1 = cleanText(extractTag(block, 'l1'));
    const l2 = cleanText(extractTag(block, 'l2'));
    const l3 = cleanText(extractTag(block, 'l3'));
    const l4 = cleanText(extractTag(block, 'l4'));
    const hints: TaskHints = {
      L1: l1 ? [l1] : ['先别急着写代码：用一句话说说，这一步你想把输入变成什么输出？'],
      L2: l2 ? [l2] : ['对照骨架代码里的 TODO 注释，逐个列出你要实现的函数名和它们的输入输出。'],
      L3: l3 || '写出函数签名和中间的伪代码步骤（不超过 3 行），先不要写具体实现。',
      L4: l4 || '请先用自己的话复述思路，再尝试独立重写，不要直接抄答案。',
    };

    const instructions = cleanText(extractTag(block, 'instructions'));
    tasks.push({
      id,
      title: taskTitle,
      goal: cleanText(extractTag(block, 'goal')) || taskTitle,
      instructions,
      brief: cleanText(extractTag(block, 'brief')) || instructions || `请完成这一步：${taskTitle}`,
      explain: cleanText(extractTag(block, 'explain')) || '',
      skeleton,
      language,
      acceptance,
      hints,
      reference,
    });
  }

  return {
    title: title || '编程实践项目',
    overview,
    language: planLangText === 'python' ? 'python' : 'javascript',
    tasks,
  };
}

/* ------------------------------------------------------------------ */
/* 计划服务                                                            */
/* ------------------------------------------------------------------ */

export class PlanService {
  constructor(
    private readonly llm: LLMProvider,
    private readonly runner: CodeRunner,
    /** 计划缓存（相同需求第二次直接秒开）；可注入 SQLite 实现 */
    private readonly cache?: KeyValueStore<ProjectPlan>,
  ) {}

  /**
   * 生成学习计划（带缓存与时间预算）：
   * 1. 相同需求直接命中缓存；
   * 2. LLM 生成 → 质量闸门 → 定向修复；时间预算 120s，超时直接回退内置模板；
   * 3. 结果写入缓存，下次秒开。
   */
  async generate(goal: string): Promise<ProjectPlan> {
    if (!this.llm.enabled) return buildFallbackPlan(goal);

    const cacheKey = hashGoal(goal);
    if (this.cache) {
      const hit = this.cache.get(cacheKey);
      if (hit) {
        console.log('[plan] 命中计划缓存，直接复用');
        return hit;
      }
    }

    const startedAt = Date.now();
    const budgetLeft = (): number => PLAN_TIME_BUDGET_MS - (Date.now() - startedAt);
    let plan: ProjectPlan | null = null;

    for (let round = 0; round < 2 && budgetLeft() > 20_000; round += 1) {
      const candidate = await this.generateOnce(goal, round);
      if (!candidate) continue;

      let validation = await this.validatePlan(candidate);
      let repairs = 0;
      while (!validation.ok && validation.taskIndex >= 0 && repairs < 3 && budgetLeft() > 15_000) {
        repairs += 1;
        console.warn(
          `[plan] 第 ${round + 1} 轮：定向修复任务 ${validation.taskIndex + 1}（${validation.reason}）`,
        );
        const repaired = await this.repairTask(candidate, validation.taskIndex, validation.reason);
        if (!repaired) break;
        validation = await this.validatePlan(candidate);
      }
      if (validation.ok) {
        plan = candidate;
        break;
      }
      console.warn(`[plan] 第 ${round + 1} 轮未通过质量校验（${validation.reason}）`);
    }

    if (!plan) {
      console.warn('[plan] LLM 计划生成最终失败，已回退到内置模板');
      plan = buildFallbackPlan(goal);
    }
    if (this.cache) this.cache.set(cacheKey, plan);
    return plan;
  }

  /** 生成一份计划（XML 解析 + 结构校验），失败返回 null。 */
  private async generateOnce(goal: string, round: number): Promise<ProjectPlan | null> {
    const temperature = round === 0 ? 0.3 : 0.1;
    const feedback =
      round > 0
        ? '注意：上一次生成没有通过质量校验，请严格按照示例 XML 重新生成，自测必须是真实断言，参考实现必须能运行并打印验收值。'
        : '';
    const raw = await this.llm.chat(
      [
        { role: 'system', content: PLAN_XML_SYSTEM_PROMPT },
        { role: 'user', content: `学生需求：${goal}` },
        ...(feedback ? [{ role: 'user' as const, content: feedback }] : []),
      ],
      { temperature, maxTokens: 2200 },
    );
    if (!raw) return null;
    const plan = parsePlanXml(raw);
    if (!plan) console.warn(`[plan] 第 ${round + 1} 轮输出无法解析`);
    return plan;
  }

  /**
   * 定向修复：只重写一个失败的任务。
   * 采用「两个代码块」格式（而不是完整 XML）——实测小模型对这种格式的遵循度最高：
   * 4 秒左右返回，且一次修复大多就能通过质量闸门。
   */
  private async repairTask(plan: ProjectPlan, taskIndex: number, reason: string): Promise<boolean> {
    const task = plan.tasks[taskIndex];
    const prompt = `修复一个编程教学任务的代码设计。任务设计有质量问题，需要你只重写这个任务的起始代码和参考实现。

任务：${task.title}（${task.language}）
任务目标：${task.goal}
老师的开场指令：${task.brief}
失败原因：${reason}

当前起始代码：
\`\`\`${task.language}
${task.skeleton}
\`\`\`
当前参考实现：
\`\`\`${task.language}
${task.reference}
\`\`\`

必须满足（违反任何一条都会被系统拒绝）：
1. 起始代码里的函数体必须留空，只有一行 TODO 注释（例如 // TODO: 返回 a 与 b 的和），绝对不能在起始代码里写实现——那是学生要写的；禁止讲解性注释；
2. 起始代码最后一行自测必须是真实断言：用 console.log('通过:', add(2, 3) === 5)（JavaScript）或 print('通过:', add(2, 3) == 5)（Python）这种形式；禁止 console.log('通过: true') / print('通过: True') 这种恒为真写法；禁止使用 assert（未实现时会直接崩溃）；
3. 参考实现必须完整、可运行，最后一行同样用 console.log/print 自测并打印 通过: true，禁止 assert；
4. 代码是纯脚本：禁止 DOM/浏览器 API、禁止 require/import、禁止网络和文件访问；
5. 只输出两个代码块，格式完全如下，不要任何解释：

<!-- SKELETON -->
\`\`\`${task.language}
...修正后的起始代码...
\`\`\`

<!-- REFERENCE -->
\`\`\`${task.language}
...修正后的参考实现...
\`\`\``;
    const raw = await this.llm.chat(
      [
        { role: 'system', content: '你只输出格式要求的两个代码块，不要任何解释文字。' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.2, maxTokens: 1200 },
    );
    if (!raw) return false;
    const blocks = parseRepairBlocks(raw);
    if (!blocks) return false;
    task.skeleton = blocks.skeleton;
    task.reference = blocks.reference;
    return true;
  }

  /** 质量闸门：实际运行每个任务的参考实现与起始代码，验证计划真的可用；返回失败任务下标。 */
  private async validatePlan(
    plan: ProjectPlan,
  ): Promise<{ ok: boolean; reason: string; taskIndex: number }> {
    if (plan.tasks.length === 0) return { ok: false, reason: '没有任务', taskIndex: -1 };
    for (let index = 0; index < plan.tasks.length; index += 1) {
      const task = plan.tasks[index];
      if (!task.reference.trim()) {
        return { ok: false, reason: `任务 ${task.id} 缺少参考实现`, taskIndex: index };
      }

      const referenceRun = await this.runner.run(task.reference, task.language);
      if (task.acceptance.type === 'output_contains' && !this.acceptancePassed(task.acceptance, referenceRun)) {
        // 自动修复：模型写的验收值大小写/全角可能不一致，从参考输出里提取正确的通过行
        const repaired = this.repairAcceptanceValue(task.acceptance, referenceRun.stdout);
        if (repaired) task.acceptance = repaired;
      }
      if (!this.acceptancePassed(task.acceptance, referenceRun)) {
        return { ok: false, reason: `任务 ${task.id} 的参考实现没有打印验收值`, taskIndex: index };
      }

      const skeletonRun = await this.runner.run(task.skeleton, task.language);
      if (!skeletonRun.ok) {
        return {
          ok: false,
          reason: `任务 ${task.id} 的起始代码无法运行（${skeletonRun.stderr.slice(0, 80)}）`,
          taskIndex: index,
        };
      }
      if (task.acceptance.type === 'output_contains' && this.acceptancePassed(task.acceptance, skeletonRun)) {
        return {
          ok: false,
          reason: `任务 ${task.id} 的起始代码直接通过验收，自测缺少实际意义`,
          taskIndex: index,
        };
      }
    }
    return { ok: true, reason: '', taskIndex: -1 };
  }

  /** 从参考实现的输出里提取“通过: true”一类验收行，修复大小写/冒号不一致。 */
  private repairAcceptanceValue(acceptance: AcceptanceSpec, stdout: string): AcceptanceSpec | null {
    if (acceptance.type !== 'output_contains') return null;
    const match = stdout.match(/通过\s*[：:]\s*(true|True|TRUE)/);
    if (!match) return null;
    return { type: 'output_contains', value: match[0] };
  }

  private acceptancePassed(acceptance: AcceptanceSpec, run: RunResult): boolean {
    if (!run.ok) return false;
    if (acceptance.type === 'exit_zero') return true;
    const expected = acceptance.value ?? '';
    return expected.length > 0 && run.stdout.includes(expected);
  }
}
