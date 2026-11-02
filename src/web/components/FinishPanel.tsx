import type { SessionState } from '../../shared/types';

export function FinishPanel({
  session,
  onReset,
  onOpenKnowledge,
}: {
  session: SessionState;
  onReset: () => void;
  onOpenKnowledge: () => void;
}) {
  return (
    <main className="finish">
      <h1>🎉 项目完成</h1>
      <p>你独立完成了 {session.plan.tasks.length} 个步骤：</p>
      <ul>
        {session.plan.tasks.map((task, index) => (
          <li key={task.id}>
            ✓ 第 {index + 1} 步：{task.title}
          </li>
        ))}
      </ul>
      <div className="finish-actions">
        <button className="btn ghost" onClick={onOpenKnowledge}>
          📚 查看知识库
        </button>
        <button className="btn primary" onClick={onReset}>
          开始新项目
        </button>
      </div>
    </main>
  );
}
