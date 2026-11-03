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

const PLAN_XML_SYSTEM_PROMPT = `你是「桃花源码」的编程老师，学生是零基础初学者——没学过任何编程概念，甚至不知道程序是怎么运行的。
所以教学必须「先教，再练」：每一步 = 一节迷你课，先讲清一个概念，再给学生一个能照抄的例子，让他亲手写出来。

设计原则：
- 目标导向：项目最终要「真的做出来、能用」，按学生最初的需求设计成品（例如用户要「能用的待办清单」，最后一步必须做出能添加、查看、勾选、删除的完整小工具，而不是只学几个概念）；
- 整个项目共 3-6 步（至少 3 步，第 1 步最简单，最后一步「让成品真正用起来」）：开头是零基础概念（打印 → 变量 → 数组），后面是功能（添加、查看、勾选、删除等），最后一步把它们整合成完整可用的小工具；
- 最后一步的任务名要像「让清单真正用起来」这样的整合步骤，验收必须能看到成品真正在工作的结果（例如依次打印：添加后 → 勾选后 → 删除后的清单状态）；
- 中间每一步都是通往成品的子目标，一步只引入 1 个新概念；
- 沙箱没有命令行交互：成品用「函数 + 打印演示」的方式呈现，让学生看到完整效果；
- 之后每步只引入 1 个新概念，顺序建议：变量 → 数组/字符串 → 条件判断 → 循环 → 函数 → 组合；
- 每步 brief 必须包含四段（口语化）：
  1) 概念解释：用生活比喻讲清这个概念是什么（如「变量 = 贴了标签的盒子」）；
  2) 语法模板：给出写法（如 const 名字 = 值;）；
  3) 小例子：给出 1-3 行能直接运行的例子（同时写进 example 字段）；
  4) 具体任务：具体到能照做（「在编辑区写下：const list = [];」），禁止只说「写个东西来存放」这种模糊指令；
- 概念解释只讲本步的新概念，不要提前引入后面才教的概念（例如只教 console.log 的步骤里不要出现变量）；
- 后一步必须回扣学过的东西（「还记得第 1 步的 console.log 吗？这次用它来…」）；
- 脚手架渐隐：前几步任务几乎可照抄示例；最后一步减少提示，让学生独立完成；
- 验收用 output_contains（学生写对后程序会输出这段文字，例如「你好，桃花源」），或 exit_zero；
- brief 里不要写「老师的话：」之类的开头前缀，直接说内容。

运行环境硬性约束（必须遵守）：
- 代码运行在纯 Node 沙箱（JavaScript）或纯 Python 子进程里：单文件脚本，禁止 DOM/HTML/CSS/浏览器 API、禁止 require/import、禁止网络和文件访问、禁止定时器；
- 代码里禁止讲解性注释，最多一行 TODO（例如 // TODO: 照着上面的例子写一行），所有讲解都放在 brief / explain / example 里。

严格只输出下面这种 XML 格式（不要 markdown 代码块、不要任何解释文字）。为了速度，输出尽量精简：
<plan>
<title>项目名（简短，突出学什么）</title>
<overview>一两句话说明路线与最终产物</overview>
<language>javascript</language>
<task>
<id>task-1</id>
<title>第一步的名字（口语化，如：让程序说句话）</title>
<concept>这一步学的新概念（如：输出文字 console.log）</concept>
<goal>这一步训练什么能力</goal>
<brief>老师的话：概念解释 + 语法模板 + 小例子 + 具体任务（2-4 句）</brief>
<example><![CDATA[
一个能直接运行的最小例子
]]></example>
<skeleton><![CDATA[
// TODO: 照着上面的例子写一行
]]></skeleton>
<lang>javascript</lang>
<acceptance_type>output_contains</acceptance_type>
<acceptance_value>你好，桃花源</acceptance_value>
<l1>方向问句，不给定位不给代码</l1>
<l2>定位提示，指出大致位置或概念</l2>
<l3>写法模板或伪代码，最多 3 行</l3>
<l4>复述要求：要求学生先用自己的话复述，再重写</l4>
<reference><![CDATA[
参考实现（必须能运行，并输出 acceptance_value 里的文字）
]]></reference>
</task>
</plan>

硬性要求：
1. skeleton、example、reference 必须写在 <![CDATA[ ... ]]> 里；reference 必须能运行并输出 acceptance_value；
2. skeleton 里除了 TODO 注释之外，禁止写任何会运行的代码（示例代码只能放 example；skeleton 未实现时绝不能输出 acceptance_value，否则学生什么都没写就通过了）；
3. 每步只引入一个新概念，后一步复用前一步学过的东西；
4. 最后一步必须把全部学过的组合成能运行、能看到完整效果的成品（验收里能体现「项目真的用起来了」）；
5. 默认语言 javascript；只有需求明确是 Python 时用 python；
6. 单个代码示例不超过 15 行；整体输出尽量精简；
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
    const rawBrief = cleanText(extractTag(block, 'brief')) || instructions || `请完成这一步：${taskTitle}`;
    tasks.push({
      id,
      title: taskTitle,
      goal: cleanText(extractTag(block, 'goal')) || taskTitle,
      concept: cleanText(extractTag(block, 'concept')) || undefined,
      instructions,
      brief: rawBrief.replace(/^老师的话[:：]\s*/, ''),
      example: stripCdata(extractTag(block, 'example')) || undefined,
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
        ? '注意：上一次生成没有通过质量校验，请严格按照示例 XML 重新生成：至少 3 步（3-6 步）；每步只讲一个概念，不要提前引入后面才教的概念；最后一步必须整合成能用的成品；示例代码必须能直接运行；brief 不要写「老师的话：」前缀。'
        : '';
    const raw = await this.llm.chat(
      [
        { role: 'system', content: PLAN_XML_SYSTEM_PROMPT },
        { role: 'user', content: `学生需求：${goal}` },
        ...(feedback ? [{ role: 'user' as const, content: feedback }] : []),
      ],
      { temperature, maxTokens: 3800 },
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
1. 起始代码（skeleton）里除了 TODO 注释之外，不允许写任何会运行的代码——示例代码只能放在 example 里，起始代码绝不能直接输出验收文字；
2. 参考实现必须完整、可运行，并且会输出验收文字（通过: true 或该步骤的验收内容）；
3. 代码是纯脚本：禁止 DOM/浏览器 API、禁止 require/import、禁止网络和文件访问；
4. 只输出两个代码块，格式完全如下，不要任何解释：

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
    if (plan.tasks.length < 3) {
      return { ok: false, reason: '任务太少：至少需要 3 步才能做出可用的成品', taskIndex: -1 };
    }
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

  /** 校验一组新任务（用于「继续完善」扩展流程）。 */
  private async validateTasks(tasks: TaskNode[]): Promise<{ ok: boolean; reason: string }> {
    for (const task of tasks) {
      if (!task.reference.trim()) return { ok: false, reason: `任务 ${task.id} 缺少参考实现` };
      const referenceRun = await this.runner.run(task.reference, task.language);
      if (task.acceptance.type === 'output_contains' && !this.acceptancePassed(task.acceptance, referenceRun)) {
        const repaired = this.repairAcceptanceValue(task.acceptance, referenceRun.stdout);
        if (repaired) task.acceptance = repaired;
      }
      if (!this.acceptancePassed(task.acceptance, referenceRun)) {
        return { ok: false, reason: `任务 ${task.id} 的参考实现没有打印验收值` };
      }
      const skeletonRun = await this.runner.run(task.skeleton, task.language);
      if (!skeletonRun.ok) return { ok: false, reason: `任务 ${task.id} 的起始代码无法运行` };
      if (task.acceptance.type === 'output_contains' && this.acceptancePassed(task.acceptance, skeletonRun)) {
        return { ok: false, reason: `任务 ${task.id} 的起始代码直接通过验收` };
      }
    }
    return { ok: true, reason: '' };
  }

  /**
   * 「继续完善」：项目学完后，学生说「我想加个删除功能」，
   * 基于已有项目上下文生成 1-3 个新的教学步骤（延续零基础五段式），校验通过后返回。
   * 失败返回 null，由领域层用内置扩展任务兜底。
   */
  async generateExtension(
    project: {
      title: string;
      overview: string;
      language: Language;
      tasks: { title: string; concept?: string }[];
    },
    request: string,
  ): Promise<TaskNode[] | null> {
    if (!this.llm.enabled) return null;
    const context = project.tasks
      .map((task, index) => `${index + 1}. ${task.title}${task.concept ? `（${task.concept}）` : ''}`)
      .join('；');
    const prompt = `你是「桃花源码」的编程老师。学生已经完成了这个项目的前几步，想继续完善它。

项目：${project.title}
已学完的步骤：${context}
学生想继续加：${request}

请设计 1-3 个新的教学步骤，让项目变得更完整可用（延续零基础五段式：先讲概念、给可运行示例、学生模仿写、运行验证、老师讲解）。

严格只输出 XML（不要 markdown 代码块、不要任何解释文字）：
<plan>
<task>
<id>ext-1</id>
<title>这一步的名字</title>
<concept>这一步学的新概念</concept>
<goal>这一步训练什么能力</goal>
<brief>老师的话：概念解释 + 语法模板 + 小例子 + 具体任务（2-4 句）</brief>
<example><![CDATA[
能直接运行的最小例子
]]></example>
<skeleton><![CDATA[
// TODO: 照着上面的例子写……
]]></skeleton>
<lang>${project.language}</lang>
<acceptance_type>output_contains</acceptance_type>
<acceptance_value>学生写对后程序会输出的文字</acceptance_value>
<l1>方向问句</l1>
<l2>定位提示</l2>
<l3>写法模板或伪代码</l3>
<l4>复述要求</l4>
<reference><![CDATA[
参考实现（必须能运行并输出 acceptance_value 里的文字）
]]></reference>
</task>
</plan>

硬性要求：
1. 至少 1 步、最多 3 步；每步能独立运行，验收用 output_contains；
2. skeleton 只有 TODO 注释、禁止可运行代码；reference 必须能运行并输出验收文字；
3. 后一步回扣前面学过的概念（包括原项目学过的）；
4. 纯脚本沙箱：禁止 DOM/浏览器 API、require/import、网络、文件访问；单个代码示例不超过 15 行；
5. 语言沿用项目语言。`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await this.llm.chat(
        [
          { role: 'system', content: '你只输出 XML，不要任何解释文字。' },
          {
            role: 'user',
            content: prompt + (attempt > 0 ? '\n\n注意：上一次输出没有通过质量校验，请严格按格式重新生成。' : ''),
          },
        ],
        { temperature: attempt === 0 ? 0.3 : 0.15, maxTokens: 2600 },
      );
      if (!raw) continue;
      const plan = parsePlanXml(raw);
      if (!plan || plan.tasks.length === 0 || plan.tasks.length > 3) continue;
      const validation = await this.validateTasks(plan.tasks);
      if (validation.ok) return plan.tasks;
      console.warn(`[plan] 扩展步骤未通过质量校验（${validation.reason}）`);
    }
    return null;
  }

  private acceptancePassed(acceptance: AcceptanceSpec, run: RunResult): boolean {
    if (!run.ok) return false;
    if (acceptance.type === 'exit_zero') return true;
    const expected = acceptance.value ?? '';
    return expected.length > 0 && run.stdout.includes(expected);
  }
}
