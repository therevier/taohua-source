import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** 极简 .env 加载器：读取项目根目录的 .env（不覆盖已有环境变量），避免引入额外依赖。 */
function loadDotEnv(): void {
  const file = path.resolve(process.cwd(), '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** 服务端配置：全部来自环境变量，默认值面向本地演示。 */
export interface AppConfig {
  port: number;
  llm: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    model: string;
    jsonMode: boolean;
  };
  pythonBin: string;
}

export function loadConfig(): AppConfig {
  loadDotEnv();
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  // Hugging Face Spaces 固定监听 7860（通过 SPACE_ID 环境变量自动识别）
  const defaultPort = process.env.SPACE_ID ? 7860 : 8787;
  return {
    port: Number(process.env.PORT || defaultPort),
    llm: {
      enabled: Boolean(apiKey),
      apiKey,
      baseUrl: (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      jsonMode: (process.env.LLM_JSON_MODE || 'true') !== 'false',
    },
    pythonBin: process.env.PYTHON_BIN || 'python',
  };
}
