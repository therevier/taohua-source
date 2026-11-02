import type { KnowledgeCard } from '../api';

/** 极简知识库：已完成步骤沉淀的知识卡片列表 */
export function KnowledgeView({
  cards,
  onBack,
}: {
  cards: KnowledgeCard[] | null;
  onBack: () => void;
}) {
  return (
    <main className="knowledge">
      <div className="knowledge-head">
        <h1>📚 知识库</h1>
        <button className="link-btn" onClick={onBack}>
          ← 返回
        </button>
      </div>
      <p className="knowledge-sub">每完成一步，这里会自动记下你学到的东西。</p>
      {cards === null ? (
        <p className="knowledge-empty">加载中…</p>
      ) : cards.length === 0 ? (
        <p className="knowledge-empty">还没有知识卡片——完成任意一步后，这里会自动记录。</p>
      ) : (
        <ul className="card-list">
          {cards.map((card) => (
            <li key={card.id} className="k-card">
              <div className="k-card-title">{card.title}</div>
              <div className="k-card-summary">{card.summary}</div>
              <div className="k-card-meta">{card.project}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
