import { useEffect, useState } from 'react';
import type { SessionSummary } from '../api';

const EXAMPLES = [
  '用 JavaScript 写一个待办清单小工具',
  '用 JavaScript 做一个四则运算计算器',
  '用 Python 统计一段文本的词频',
];

export function StartScreen({
  onCreate,
  creating,
  sessions,
  onPickSession,
  onOpenKnowledge,
}: {
  onCreate: (goal: string) => void;
  creating: boolean;
  sessions: SessionSummary[] | null;
  onPickSession: (id: string) => void;
  onOpenKnowledge: () => void;
}) {
  const [goal, setGoal] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!creating) {
      setElapsed(0);
      return;
    }
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [creating]);

  const history = (sessions ?? []).slice(0, 6);

  return (
    <main className="start">
      <h1>桃花源里，写下第一行代码</h1>
      <p className="start-sub">初极狭，后豁然开朗。</p>
      <div className="start-box">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="例如：用 JavaScript 写一个待办清单小工具"
          rows={3}
        />
        <button
          className="btn primary big"
          onClick={() => onCreate(goal)}
          disabled={creating || goal.trim().length < 4}
        >
          {creating ? `老师正在备课… ${elapsed}s` : '开始学习'}
        </button>
      </div>
      <div className="examples">
        <span>试试：</span>
        {EXAMPLES.map((example) => (
          <button key={example} className="chip" onClick={() => setGoal(example)}>
            {example}
          </button>
        ))}
        <button className="link-btn" onClick={onOpenKnowledge}>
          📚 知识库
        </button>
      </div>
      {history.length > 0 && (
        <div className="history">
          <div className="history-title">继续学习</div>
          {history.map((item) => (
            <button key={item.id} className="history-item" onClick={() => onPickSession(item.id)}>
              <span className="history-name">{item.title}</span>
              <span className="history-meta">
                {item.finished ? '已完成' : `进度 ${item.completedCount}/${item.totalTasks}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
