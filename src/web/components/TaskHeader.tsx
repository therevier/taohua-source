import type { PublicTask } from '../../shared/types';

export function TaskHeader({ task, index, total }: { task: PublicTask; index: number; total: number }) {
  return (
    <div className="task-header">
      <div className="task-step">
        第 {index + 1} / {total} 步
      </div>
      <h2>{task.title}</h2>
      <p className="task-goal">🎯 {task.goal}</p>
    </div>
  );
}
