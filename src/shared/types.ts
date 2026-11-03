/**
 * 前后端共享的核心类型（唯一事实来源）。
 *
 * 设计原则：服务端内部使用的 TaskNode 带「教师端参考答案 reference」，
 * 客户端永远只能拿到 PublicTask（reference 已被剥离，见 SessionState）。
 */

export type Language = 'javascript' | 'python';

/** 提示阶梯：L1 方向问句 → L2 定位 → L3 伪代码 → L4 完整答案 */
export type HintLevel = 1 | 2 | 3 | 4;

/** 验收标准：output_contains 要求标准输出包含指定文本；exit_zero 要求程序正常结束 */
export interface AcceptanceSpec {
  type: 'output_contains' | 'exit_zero';
  value?: string;
}

/** 每个任务的离线兜底提示库（LLM 不可用时使用，也可作为 LLM 提示的素材） */
export interface TaskHints {
  L1: string[];
  L2: string[];
  L3: string;
  L4: string;
}

/** 一个教学任务节点（服务端完整版） */
export interface TaskNode {
  id: string;
  title: string;
  /** 教学目的：这一步训练什么能力 */
  goal: string;
  /** 这一步要教的「一个」新概念（零基础教学：每步只引入一个概念） */
  concept?: string;
  /** 给学生看的说明与建议 */
  instructions: string;
  /** 导师在对话框里给这一步的「要写什么」：先讲概念，再给语法模板和可运行小例子，最后布置模仿任务 */
  brief: string;
  /** 一个可以直接运行的最小示例代码（学生先读懂，再照着写） */
  example?: string;
  /** 写完这一步后导师的讲解：写出的东西是什么、为什么需要它、易错点、和整体的关系 */
  explain: string;
  /** 起始代码（含 TODO 注释与「不要修改」的自测代码） */
  skeleton: string;
  language: Language;
  acceptance: AcceptanceSpec;
  hints: TaskHints;
  /** 教师端参考答案，只在服务端使用，永远不会下发到客户端 */
  reference: string;
}

/** 整个学习项目计划（服务端完整版） */
export interface ProjectPlan {
  title: string;
  overview: string;
  language: Language;
  tasks: TaskNode[];
}

/** 客户端可见的任务（服务端剥离了 reference） */
export type PublicTask = Omit<TaskNode, 'reference'>;

/** 客户端可见的计划 */
export type PublicPlan = Omit<ProjectPlan, 'tasks'> & { tasks: PublicTask[] };

/** 一次学习会话的完整状态（客户端可见版） */
export interface SessionState {
  id: string;
  goal: string;
  plan: PublicPlan;
  /** 当前进行到的任务下标（等于 tasks.length 表示全部完成） */
  currentTaskIndex: number;
  completedTaskIds: string[];
  /** 导师对话记录（含系统自动补充的提示消息） */
  chat: ChatTurn[];
}

/** 单条对话消息 */
export interface ChatTurn {
  role: 'student' | 'tutor';
  content: string;
  at: number;
  /** 若该消息是提示，标注其阶梯等级 */
  level?: HintLevel | null;
}

/** 学生编辑活动的快照（由浏览器上报，用于卡壳检测） */
export interface ActivitySnapshot {
  taskId: string;
  /** 距上次上报又编辑了多少次 */
  editsSinceLastReport: number;
  /** 距最近一次编辑过去了多少毫秒 */
  idleMs: number;
  /** 连续多少次运行失败（成功运行会清零） */
  consecutiveFailedRuns: number;
  /** 编辑区当前是否有内容 */
  hasCode: boolean;
  updatedAt: number;
}

/** 一次代码运行的结果 */
export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/** 提示请求的结果 */
export interface HintOutcome {
  /** 是否判定为卡壳 */
  stalled: boolean;
  /** 本次给出的提示等级（没有给出提示时为 null） */
  level: HintLevel | null;
  /** 本次提示正文（没有给出提示时为 null） */
  hint: string | null;
}
