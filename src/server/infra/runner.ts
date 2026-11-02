import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Language, RunResult } from '../../shared/types';

/** 代码运行器抽象：领域层只依赖这个接口，后续可换成 Docker/Piston 等隔离方案。 */
export interface CodeRunner {
  run(code: string, language: Language): Promise<RunResult>;
}

const JS_TIMEOUT_MS = 2000;
const PY_TIMEOUT_MS = 3000;

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/** Node 内置 vm 运行 JS：没有 require/process，适合教学练习（非安全边界）。 */
async function runJavaScript(code: string): Promise<RunResult> {
  const logs: string[] = [];
  const start = Date.now();
  const capture =
    (prefix: string) =>
    (...args: unknown[]) => {
      logs.push(`${prefix}${args.map(formatConsoleArg).join(' ')}`);
    };
  const sandbox = {
    console: {
      log: capture(''),
      info: capture(''),
      warn: capture(''),
      error: capture('[错误] '),
    },
  };
  try {
    const context = vm.createContext(sandbox, {
      codeGeneration: { strings: true, wasm: false },
    });
    const script = new vm.Script(code, { filename: 'student.js' });
    script.runInContext(context, { timeout: JS_TIMEOUT_MS });
    return {
      ok: true,
      stdout: logs.join('\n'),
      stderr: '',
      durationMs: Date.now() - start,
      timedOut: false,
    };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const timedOut = message.includes('Script execution timed out');
    return {
      ok: false,
      stdout: logs.join('\n'),
      stderr: timedOut ? `[超时] 代码在 ${JS_TIMEOUT_MS / 1000} 秒内没有结束，已强制终止。` : message,
      durationMs: Date.now() - start,
      timedOut,
    };
  }
}

/** 通过子进程运行 Python 完整脚本（强制 UTF-8 输出，避免 Windows 中文系统 GBK 编码导致验收乱码）。 */
async function runPython(code: string, pythonBin: string): Promise<RunResult> {
  const dir = await mkdtemp(join(tmpdir(), 'code-mentor-py-'));
  const file = join(dir, 'student.py');
  await writeFile(file, code, 'utf8');
  const start = Date.now();
  try {
    return await new Promise<RunResult>((resolve) => {
      const child = spawn(pythonBin, [file], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, PY_TIMEOUT_MS);
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: `无法启动 Python（${pythonBin}）：${err.message}`,
          durationMs: Date.now() - start,
          timedOut: false,
        });
      });
      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const stdout = Buffer.concat(stdoutChunks).toString('utf8');
        let stderr = Buffer.concat(stderrChunks).toString('utf8');
        if (timedOut) {
          stderr += `\n[超时] 代码在 ${PY_TIMEOUT_MS / 1000} 秒内没有结束，已强制终止。`;
        }
        resolve({
          ok: !timedOut && exitCode === 0,
          stdout,
          stderr,
          durationMs: Date.now() - start,
          timedOut,
        });
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export class NodeSandboxRunner implements CodeRunner {
  constructor(private readonly pythonBin: string) {}

  run(code: string, language: Language): Promise<RunResult> {
    return language === 'python' ? runPython(code, this.pythonBin) : runJavaScript(code);
  }
}
