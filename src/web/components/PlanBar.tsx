import type { PublicTask, SessionState } from '../../shared/types';

/** 极简步骤条：只显示任务名与状态（✓ 已完成 / ● 进行中 / ○ 未开始） */
export function PlanBar({ session }: { session: SessionState }) {
  return (
    <ol className="plan-steps">
      {session.plan.tasks.map((task: PublicTask, index: number) => {
        const state =
          index < session.currentTaskIndex
            ? 'done'
            : index === session.currentTaskIndex
              ? 'current'
              : 'pending';
        return (
          <li key={task.id} className={`plan-step ${state}`} title={task.title}>
            <span className="plan-step-icon">{state === 'done' ? '✓' : state === 'current' ? '●' : '○'}</span>
            <span className="plan-step-title">{task.title}</span>
          </li>
        );
      })}
    </ol>
  );
}
