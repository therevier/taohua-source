/** LLM 抽象：领域层只依赖这个接口，不关心具体是哪家模型。 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** 是否要求服务端以 JSON 对象返回（不支持的模型由配置开关关闭） */
  json?: boolean;
}

export interface LLMProvider {
  /** 是否已配置可用（false 时领域层自动走离线兜底） */
  readonly enabled: boolean;
  /** 当前使用的模型名（用于界面展示） */
  readonly model?: string;
  /** 普通对话；失败返回 null，由调用方决定兜底 */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string | null>;
  /** 流式对话：每收到一段文本调用一次 onDelta；失败返回 null */
  chatStream(
    messages: ChatMessage[],
    options: ChatOptions,
    onDelta: (text: string) => void,
  ): Promise<string | null>;
  /** 要求返回 JSON 对象；解析失败返回 null */
  chatJSON<T>(messages: ChatMessage[], options?: ChatOptions): Promise<T | null>;
}
