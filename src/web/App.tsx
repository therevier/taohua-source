import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicTask, RunResult, SessionState } from '../shared/types';
import { api, chatStream, type KnowledgeCard, type SessionSummary } from './api';
import { StartScreen } from './components/StartScreen';
import { ChatPanel } from './components/ChatPanel';
import { PlanBar } from './components/PlanBar';
import { TaskHeader } from './components/TaskHeader';
import { EditorPanel } from './components/EditorPanel';
import { RunOutput } from './components/RunOutput';
import { FinishPanel } from './components/FinishPanel';
import { EntryAnimation } from './components/EntryAnimation';
import { KnowledgeView } from './components/KnowledgeView';

type View = 'start' | 'knowledge';

const ACTIVITY_REPORT_INTERVAL_MS = 8000;
const SESSION_STORAGE_KEY = 'code-mentor.sessionId';
const codeStorageKey = (sessionId: string): string => `code-mentor.code.${sessionId}`;

function loadSavedCodes(sessionId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(codeStorageKey(sessionId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export default function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [view, setView] = useState<View>('start');
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [cards, setCards] = useState<KnowledgeCard[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [running, setRunning] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [codeByTask, setCodeByTask] = useState<Record<string, string>>({});
  const [llmEnabled, setLlmEnabled] = useState<boolean | null>(null);
  const [llmModel, setLlmModel] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [showEntry, setShowEntry] = useState(false);

  const tasks = session?.plan.tasks ?? [];
  const currentTask: PublicTask | null = session ? (tasks[session.currentTaskIndex] ?? null) : null;
  const finished = session !== null && session.currentTaskIndex >= tasks.length;
  const code = currentTask ? (codeByTask[currentTask.id] ?? currentTask.skeleton) : '';

  const activityRef = useRef({ lastEditAt: Date.now(), edits: 0, failures: 0 });
  const sessionRef = useRef<SessionState | null>(null);
  const taskRef = useRef<PublicTask | null>(null);
  const codeRef = useRef('');
  sessionRef.current = session;
  taskRef.current = currentTask;
  codeRef.current = code;

  useEffect(() => {
    api
      .health()
      .then((health) => {
        setLlmEnabled(health.llm);
        setLlmModel(health.model);
      })
      .catch(() => setLlmEnabled(false));
  }, []);

  /** 进入「开始页」时刷新历史学习列表 */
  useEffect(() => {
    if (view !== 'start') return;
    api
      .listSessions()
      .then(({ sessions: list }) => setSessions(list))
      .catch(() => setSessions([]));
  }, [view]);

  /** 刷新后自动恢复上次会话 */
  useEffect(() => {
    const savedId = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!savedId) return;
    api
      .getSession(savedId)
      .then(({ session: restored }) => {
        const savedCodes = loadSavedCodes(restored.id);
        setCodeByTask(
          Object.fromEntries(
            restored.plan.tasks.map((task) => [task.id, savedCodes[task.id] ?? task.skeleton]),
          ),
        );
        setSession(restored);
      })
      .catch(() => {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      });
  }, []);

  const resetActivity = useCallback(() => {
    activityRef.current = { lastEditAt: Date.now(), edits: 0, failures: 0 };
  }, []);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : '操作失败，请重试');
  }

  async function handleCreate(goal: string) {
    setCreating(true);
    setError(null);
    try {
      const { session: created } = await api.createSession(goal);
      window.localStorage.setItem(SESSION_STORAGE_KEY, created.id);
      setSession(created);
      setCodeByTask(Object.fromEntries(created.plan.tasks.map((task) => [task.id, task.skeleton])));
      setRunResult(null);
      resetActivity();
      setShowEntry(true);
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  }

  async function loadSession(id: string) {
    setError(null);
    try {
      const { session: restored } = await api.getSession(id);
      window.localStorage.setItem(SESSION_STORAGE_KEY, restored.id);
      const savedCodes = loadSavedCodes(restored.id);
      setCodeByTask(
        Object.fromEntries(
          restored.plan.tasks.map((task) => [task.id, savedCodes[task.id] ?? task.skeleton]),
        ),
      );
      setSession(restored);
      setRunResult(null);
      resetActivity();
      setShowEntry(false);
    } catch (err) {
      showError(err);
    }
  }

  function openKnowledge() {
    setView('knowledge');
    api
      .listKnowledge()
      .then(({ cards: list }) => setCards(list))
      .catch(() => setCards([]));
  }

  function closeKnowledge() {
    setView('start');
  }

  function persistCodes(next: Record<string, string>) {
    const id = sessionRef.current?.id;
    if (!id) return;
    try {
      window.localStorage.setItem(codeStorageKey(id), JSON.stringify(next));
    } catch {
      // localStorage 满了也不影响使用
    }
  }

  function handleCodeChange(value: string) {
    const task = taskRef.current;
    if (!task) return;
    setCodeByTask((prev) => {
      const next = { ...prev, [task.id]: value };
      persistCodes(next);
      return next;
    });
    activityRef.current.edits += 1;
    activityRef.current.lastEditAt = Date.now();
  }

  function handleResetCode() {
    const task = taskRef.current;
    if (!task) return;
    setCodeByTask((prev) => {
      const next = { ...prev, [task.id]: task.skeleton };
      persistCodes(next);
      return next;
    });
    setRunResult(null);
  }

  function buildActivity(task: PublicTask) {
    const stats = activityRef.current;
    const snapshot = {
      taskId: task.id,
      editsSinceLastReport: stats.edits,
      idleMs: Date.now() - stats.lastEditAt,
      consecutiveFailedRuns: stats.failures,
      hasCode: codeRef.current.trim().length > 0,
    };
    stats.edits = 0;
    return snapshot;
  }

  async function handleRun() {
    const s = sessionRef.current;
    const task = taskRef.current;
    if (!s || !task) return;
    setRunning(true);
    setError(null);
    try {
      const { result } = await api.run(s.id, task.id, codeRef.current);
      setRunResult(result);
      activityRef.current.failures = result.ok ? 0 : activityRef.current.failures + 1;
    } catch (err) {
      showError(err);
    } finally {
      setRunning(false);
    }
  }

  async function handleComplete() {
    const s = sessionRef.current;
    const task = taskRef.current;
    if (!s || !task) return;
    setCompleting(true);
    setError(null);
    try {
      const outcome = await api.complete(s.id, task.id, codeRef.current);
      setSession(outcome.session);
      if (outcome.passed) {
        setRunResult(null);
        resetActivity();
      }
    } catch (err) {
      showError(err);
    } finally {
      setCompleting(false);
    }
  }

  async function handleAskHint() {
    const s = sessionRef.current;
    const task = taskRef.current;
    if (!s || !task) return;
    try {
      const outcome = await api.askHint(s.id, {
        taskId: task.id,
        code: codeRef.current,
        activity: buildActivity(task),
      });
      if (outcome.hint) {
        const fresh = await api.getSession(s.id);
        setSession(fresh.session);
      }
    } catch (err) {
      showError(err);
    }
  }

  async function handleSend(message: string) {
    const s = sessionRef.current;
    const task = taskRef.current;
    if (!s || !task || sending) return;
    setSending(true);
    setError(null);
    setPendingUser(message);
    setStreamingText('');
    try {
      const outcome = await chatStream(s.id, message, codeRef.current, (text) => {
        setStreamingText((prev) => prev + text);
      });
      if (outcome.error) throw new Error(outcome.error);
      if (outcome.session) setSession(outcome.session);
    } catch (err) {
      showError(err);
    } finally {
      setSending(false);
      setPendingUser(null);
      setStreamingText('');
    }
  }

  /** 每 8 秒上报一次编辑活动：服务端判定卡壳后可能主动推送一条提示。 */
  useEffect(() => {
    if (!session || !currentTask || finished) return;
    async function reportActivity() {
      const s = sessionRef.current;
      const task = taskRef.current;
      if (!s || !task) return;
      try {
        const outcome = await api.reportActivity(s.id, {
          taskId: task.id,
          code: codeRef.current,
          activity: buildActivity(task),
        });
        if (outcome.hint) {
          const fresh = await api.getSession(s.id);
          setSession(fresh.session);
        }
      } catch {
        // 轮询失败不打断学生
      }
    }
    const timer = window.setInterval(() => void reportActivity(), ACTIVITY_REPORT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [session?.id, currentTask?.id, finished]);

  function handleReset() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setCodeByTask({});
    setRunResult(null);
    setError(null);
    setPendingUser(null);
    setStreamingText('');
    setShowEntry(false);
    setView('start');
    resetActivity();
  }

  const modeChip = llmEnabled
    ? `AI 在线${llmModel ? ` · ${llmModel}` : ''}`
    : llmEnabled === null
      ? '连接中…'
      : '离线演示模式';

  if (view === 'knowledge') {
    return (
      <div className="app">
        <header className="app-header">
          <div className="brand">
            <span className="brand-icon">🌸</span>
            <strong>桃花源码</strong>
            <span className="brand-sub">步步寻源，豁然开朗</span>
          </div>
        </header>
        <KnowledgeView cards={cards} onBack={closeKnowledge} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="brand">
            <span className="brand-icon">🌸</span>
            <strong>桃花源码</strong>
            <span className="brand-sub">步步寻源，豁然开朗</span>
          </div>
          <span className={`mode-chip ${llmEnabled ? 'on' : ''}`}>{modeChip}</span>
        </header>
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button className="btn ghost small" onClick={() => setError(null)}>
              知道了
            </button>
          </div>
        )}
        <StartScreen
          onCreate={(goal) => void handleCreate(goal)}
          creating={creating}
          sessions={sessions}
          onPickSession={(id) => void loadSession(id)}
          onOpenKnowledge={openKnowledge}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">🌸</span>
          <strong>{session.plan.title}</strong>
        </div>
        <div className="header-meta">
          <span className="progress-chip">
            {session.completedTaskIds.length}/{tasks.length}
          </span>
          <span className={`mode-chip ${llmEnabled ? 'on' : ''}`}>{modeChip}</span>
          <button className="btn ghost small" onClick={handleReset}>
            新项目
          </button>
        </div>
      </header>
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="btn ghost small" onClick={() => setError(null)}>
            知道了
          </button>
        </div>
      )}
      {finished ? (
        <FinishPanel session={session} onReset={handleReset} onOpenKnowledge={openKnowledge} />
      ) : currentTask ? (
        <main className="layout">
          <ChatPanel
            turns={session.chat}
            sending={sending}
            pendingUser={pendingUser}
            streamingText={streamingText}
            onSend={handleSend}
          />
          <section className="work">
            <PlanBar session={session} />
            <TaskHeader task={currentTask} index={session.currentTaskIndex} total={tasks.length} />
            <EditorPanel
              task={currentTask}
              value={code}
              onChange={handleCodeChange}
              onReset={handleResetCode}
            />
            <div className="actions">
              <button className="btn" onClick={() => void handleRun()} disabled={running || completing}>
                {running ? '运行中…' : '▶ 运行代码'}
              </button>
              <button
                className="btn primary"
                onClick={() => void handleComplete()}
                disabled={running || completing}
              >
                {completing ? '验收中…' : '✓ 提交本步'}
              </button>
              <button
                className="btn ghost"
                onClick={() => void handleAskHint()}
                disabled={sending || running || completing}
              >
                💡 提示
              </button>
            </div>
            <RunOutput result={runResult} />
          </section>
        </main>
      ) : null}
      {showEntry && <EntryAnimation onDone={() => setShowEntry(false)} />}
    </div>
  );
}
