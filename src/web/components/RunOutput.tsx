import type { RunResult } from '../../shared/types';

export function RunOutput({ result }: { result: RunResult | null }) {
  if (!result) {
    return <div className="console console-empty">运行输出会显示在这里</div>;
  }
  const status = result.timedOut
    ? '超时终止'
    : result.ok
      ? `运行成功（${result.durationMs}ms）`
      : `运行失败（${result.durationMs}ms）`;
  return (
    <div className={`console ${result.ok ? 'ok' : 'fail'}`}>
      <div className="console-status">{status}</div>
      {result.stdout && <pre>{result.stdout}</pre>}
      {result.stderr && <pre className="stderr">{result.stderr}</pre>}
    </div>
  );
}
