import type { HintLevel } from './types';

/**
 * 提示阶梯（教学法的可执行化）：
 * 学生卡住时，导师不是直接给答案，而是按 L1→L2→L3 逐级升级；
 * L4（完整答案）不自动给出，避免退化成「代写工具」。
 */
export const LEVEL_BEHAVIOR: Record<HintLevel, string> = {
  1: '方向问句：只提一个引导性问题，让学生自己说出思路；不给定位、不给代码。',
  2: '定位提示：指出大致位置或相关知识概念（例如“看第 X 行附近”“先想清楚循环边界”），但不给实现。',
  3: '接口/伪代码：最多给出函数签名或 3 行以内的伪代码步骤，严禁给出可直接运行的完整代码。',
  4: '完整参考答案：给出完整可运行代码，并附复述要求，请学生用自己的话复述后再重写一遍。',
};

/** 自动提示最高只能升到 L3，防止教学退化为代写 */
export const AUTO_HINT_MAX_LEVEL: HintLevel = 3;

/** 升级一级提示（level 0 表示尚未提示过） */
export function escalate(level: number): HintLevel {
  const next = Math.min(level + 1, AUTO_HINT_MAX_LEVEL);
  return (next < 1 ? 1 : next) as HintLevel;
}
