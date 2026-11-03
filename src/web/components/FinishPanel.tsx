import { useState } from 'react';
import type { SessionState } from '../../shared/types';

export function FinishPanel({
  session,
  onReset,
  onOpenKnowledge,
  onExtend,
  extending,
}: {
  session: SessionState;
  onReset: () => void;
  onOpenKnowledge: () => void;
  onExtend: (request: string) => void;
  extending: boolean;
}) {
  const [request, setRequest] = useState('');

  return (
    <main className="finish">
      <h1>🎉 第一版完成！</h1>
      <p>你已经能从零写出一版能用的「{session.plan.title}」：</p>
      <ul>
        {session.plan.tasks.map((task, index) => (
          <li key={task.id}>
            ✓ 第 {index + 1} 步：{task.title}
          </li>
        ))}
      </ul>

      <div className="extend-box">
        <div className="extend-title">想让它更完整？告诉老师想加什么功能：</div>
        <div className="extend-input">
          <input
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && request.trim() && !extending) onExtend(request);
            }}
            placeholder="例如：给清单加一个删除待办的功能"
          />
          <button
            className="btn primary"
            disabled={extending || request.trim().length === 0}
            onClick={() => onExtend(request)}
          >
            {extending ? '老师正在备课…' : '继续完善'}
          </button>
        </div>
        <div className="extend-hint">也可以直接在左边的对话框里说：我想加一个 XX 功能</div>
      </div>

      <div className="finish-actions">
        <button className="btn ghost" onClick={onOpenKnowledge}>
          📚 查看知识库
        </button>
        <button className="btn ghost" onClick={onReset}>
          开始新项目
        </button>
      </div>
    </main>
  );
}
