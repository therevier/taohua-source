import { useEffect } from 'react';

const TOTAL_MS = 4600;

/**
 * 「桃花源」进入动画：
 * 初极狭（山中小口的一线天光）→ 豁然开朗（光缝展开、桃花绽放），
 * 用《桃花源记》的意象标记「进入项目学习」的仪式感。可点击跳过。
 */
export function EntryAnimation({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, TOTAL_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="entry" onClick={onDone} role="button" tabIndex={0} aria-label="跳过动画">
      <div className="entry-scene">
        <div className="entry-bloom" />
        <div className="entry-gate" />
        <div className="entry-lines">
          <p className="entry-line line1">
            林尽水源，便得一山。
            <br />
            山有小口，仿佛若有光。
          </p>
          <p className="entry-line line2">初极狭，才通人</p>
          <p className="entry-line line3">
            复行数十步
            <br />
            <span className="entry-bright">豁然开朗</span>
          </p>
        </div>
        <div className="entry-brand">🌸 桃花源码</div>
      </div>
      <button
        className="entry-skip"
        onClick={(event) => {
          event.stopPropagation();
          onDone();
        }}
      >
        跳过
      </button>
    </div>
  );
}
