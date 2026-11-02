import type { ActivitySnapshot } from '../../shared/types';

/** 卡壳判定策略：阈值集中在这里，方便按教学需要调整。 */
export interface StallPolicy {
  /** 编辑区还没内容时，静止多久算“起步卡壳” */
  idleStartMs: number;
  /** 有内容但长时间不动，算“深卡壳” */
  idleDeepMs: number;
  /** 连续运行失败达到多少次算卡壳 */
  failedRunThreshold: number;
}

export const DEFAULT_STALL_POLICY: StallPolicy = {
  idleStartMs: 20_000,
  idleDeepMs: 45_000,
  failedRunThreshold: 3,
};

export interface StallSignal {
  stalled: boolean;
  reasons: string[];
}

/**
 * 卡壳检测：把浏览器上报的“编辑活动快照”翻译成可解释的卡壳信号。
 * 只依赖几个可演示、可复现的信号，不做玄学“AI 感知”。
 */
export function evaluateStall(
  activity: ActivitySnapshot | null,
  policy: StallPolicy = DEFAULT_STALL_POLICY,
): StallSignal {
  if (!activity) return { stalled: false, reasons: [] };
  const reasons: string[] = [];
  if (!activity.hasCode && activity.idleMs > policy.idleStartMs) {
    reasons.push('编辑区还是空的，学生停在起步阶段');
  }
  if (activity.hasCode && activity.idleMs > policy.idleDeepMs) {
    reasons.push(`超过 ${Math.round(policy.idleDeepMs / 1000)} 秒没有新的输入`);
  }
  if (activity.consecutiveFailedRuns >= policy.failedRunThreshold) {
    reasons.push(`连续 ${activity.consecutiveFailedRuns} 次运行未通过`);
  }
  return { stalled: reasons.length > 0, reasons };
}
