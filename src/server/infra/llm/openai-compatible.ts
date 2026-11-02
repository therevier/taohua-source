import type { ChatMessage, ChatOptions, LLMProvider } from './provider';
import type { AppConfig } from '../../env';

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * OpenAI 兼容接口实现（智谱 / OpenAI / DeepSeek / 通义 等均可通过
 * LLM_BASE_URL + LLM_MODEL 接入）。
 *
 * 稳定性策略：
 * - 网络错误/5xx：自动重试 2 次（递增退避）；
 * - JSON 模式：服务商不支持时自动退回普通输出再解析；
 * - 任何失败都返回 null，由领域层兜底，绝不抛出到请求链路。
 */
export function createOpenAICompatible(config: AppConfig['llm']): LLMProvider {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  async function postChat(
    messages: ChatMessage[],
    options: ChatOptions,
    wantsJson: boolean,
  ): Promise<string | null> {
    if (!config.enabled) return null;
    let retriesLeft = MAX_RETRIES;
    let useJsonMode = wantsJson && config.jsonMode;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let status = 0;
      try {
        const body: Record<string, unknown> = {
          model: config.model,
          messages,
          temperature: options.temperature ?? 0.4,
          max_tokens: options.maxTokens ?? 1200,
        };
        if (useJsonMode) body.response_format = { type: 'json_object' };
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const content = data.choices?.[0]?.message?.content;
          return typeof content === 'string' && content.trim() ? content.trim() : null;
        }
        status = res.status;
        const errText = await res.text().catch(() => '');
        if (useJsonMode && [400, 413, 422].includes(status)) {
          useJsonMode = false;
          console.warn('[llm] 服务商不支持 JSON 模式，改用普通输出再解析');
          continue;
        }
        if (status >= 500 && retriesLeft > 0) {
          retriesLeft -= 1;
          await sleep(700 * (MAX_RETRIES - retriesLeft));
          continue;
        }
        console.error(`[llm] HTTP ${status}: ${errText.slice(0, 300)}`);
        return null;
      } catch (err) {
        if (retriesLeft > 0) {
          retriesLeft -= 1;
          await sleep(700 * (MAX_RETRIES - retriesLeft));
          continue;
        }
        console.error('[llm] request failed:', err instanceof Error ? err.message : err);
        return null;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return {
    enabled: config.enabled,
    model: config.model,
    chat(messages, options = {}) {
      return postChat(messages, options, options.json === true);
    },
    async chatJSON<T>(messages: ChatMessage[], options: ChatOptions = {}): Promise<T | null> {
      const raw = await postChat(messages, options, true);
      return safeParseJSON<T>(raw);
    },
    async chatStream(messages, options, onDelta) {
      if (!config.enabled) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let full = '';
      try {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: options.temperature ?? 0.6,
            max_tokens: options.maxTokens ?? 800,
            stream: true,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          console.error(`[llm] stream HTTP ${res.status}`);
          return null;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const piece = parsed.choices?.[0]?.delta?.content;
              if (typeof piece === 'string' && piece.length > 0) {
                full += piece;
                onDelta(piece);
              }
            } catch {
              // 忽略无法解析的 SSE 行
            }
          }
        }
        return full.length > 0 ? full : null;
      } catch (err) {
        console.error('[llm] stream failed:', err instanceof Error ? err.message : err);
        return full.length > 0 ? full : null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
