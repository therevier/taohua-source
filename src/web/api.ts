import type { ActivitySnapshot, HintOutcome, RunResult, SessionState } from '../shared/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `请求失败（${res.status}）`);
  return data as T;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** 上报给服务端的活动快照（updatedAt 由服务端补全） */
export interface ActivityPayload {
  taskId: string;
  code: string;
  activity: Omit<ActivitySnapshot, 'updatedAt'>;
}

export interface SessionSummary {
  id: string;
  goal: string;
  title: string;
  currentTaskIndex: number;
  totalTasks: number;
  completedCount: number;
  createdAt: number;
  updatedAt: number;
  finished: boolean;
}

export interface KnowledgeCard {
  id: string;
  project: string;
  title: string;
  summary: string;
  sessionId: string;
  at: number;
}

export interface HealthInfo {
  status: string;
  llm: boolean;
  model: string | null;
}

export interface ChatStreamResult {
  session: SessionState | null;
  error?: string;
}

interface StreamEvent {
  type: 'delta' | 'done' | 'error';
  text?: string;
  message?: string;
  session?: SessionState;
}

/** 流式对话客户端：SSE 解析，边收边回调。 */
export async function chatStream(
  id: string,
  message: string,
  code: string,
  onDelta: (text: string) => void,
): Promise<ChatStreamResult> {
  const res = await fetch(`/api/sessions/${id}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, code }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `请求失败（${res.status}）`);
  }
  if (!res.body) throw new Error('浏览器不支持流式响应');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let session: SessionState | null = null;
  let error: string | undefined;

  const handleEvent = (raw: string): void => {
    const line = raw.split('\n').find((item) => item.startsWith('data: '));
    if (!line) return;
    try {
      const payload = JSON.parse(line.slice(6)) as StreamEvent;
      if (payload.type === 'delta' && payload.text) onDelta(payload.text);
      else if (payload.type === 'done' && payload.session) session = payload.session;
      else if (payload.type === 'error') error = payload.message;
    } catch {
      // 忽略无法解析的 SSE 行
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      handleEvent(event);
    }
  }
  if (buffer.trim()) handleEvent(buffer);
  return { session, error };
}

/** 前端 API 客户端：所有网络调用集中在这里，方便统一加拦截/鉴权。 */
export const api = {
  health: () => request<HealthInfo>('/api/health'),

  listSessions: () => request<{ sessions: SessionSummary[] }>('/api/sessions'),

  listKnowledge: () => request<{ cards: KnowledgeCard[] }>('/api/knowledge'),

  createSession: (goal: string) => post<{ session: SessionState }>('/api/sessions', { goal }),

  getSession: (id: string) => request<{ session: SessionState }>(`/api/sessions/${id}`),

  chat: (id: string, message: string, code: string) =>
    post<{ reply: string; session: SessionState }>(`/api/sessions/${id}/chat`, { message, code }),

  reportActivity: (id: string, payload: ActivityPayload) =>
    post<HintOutcome>(`/api/sessions/${id}/activity`, payload),

  askHint: (id: string, payload: ActivityPayload) =>
    post<HintOutcome>(`/api/sessions/${id}/hint`, payload),

  run: (id: string, taskId: string, code: string) =>
    post<{ result: RunResult }>(`/api/sessions/${id}/run`, { taskId, code }),

  complete: (id: string, taskId: string, code: string) =>
    post<{ passed: boolean; reason: string; session: SessionState }>(`/api/sessions/${id}/complete`, {
      taskId,
      code,
    }),

  extend: (id: string, request: string) =>
    post<{ added: number; session: SessionState }>(`/api/sessions/${id}/extend`, { request }),
};
