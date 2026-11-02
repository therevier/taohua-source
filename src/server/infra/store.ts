import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** 会话存储抽象：领域层只依赖这个接口。 */
export interface KeyValueStore<T> {
  get(id: string): T | undefined;
  set(id: string, value: T): void;
  delete(id: string): void;
  /** 遍历全部记录（用于历史学习 / 知识库聚合），按更新时间倒序 */
  all(): Array<{ id: string; value: T; updatedAt: number }>;
}

export class InMemoryStore<T> implements KeyValueStore<T> {
  private readonly items = new Map<string, T>();

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  set(id: string, value: T): void {
    this.items.set(id, value);
  }

  delete(id: string): void {
    this.items.delete(id);
  }

  all(): Array<{ id: string; value: T; updatedAt: number }> {
    return [...this.items.entries()].map(([id, value]) => ({ id, value, updatedAt: 0 }));
  }
}

/**
 * SQLite 持久化实现（Node 内置 node:sqlite，无需任何原生依赖）。
 * 会话以 JSON 存储，刷新页面、重启服务都不丢。
 */
export class SqliteStore<T> implements KeyValueStore<T> {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS kv (
        id TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );
  }

  get(id: string): T | undefined {
    const row = this.db.prepare('SELECT value FROM kv WHERE id = ?').get(id) as
      | { value: string }
      | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return undefined;
    }
  }

  set(id: string, value: T): void {
    this.db
      .prepare(
        `INSERT INTO kv (id, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(id, JSON.stringify(value), Date.now());
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM kv WHERE id = ?').run(id);
  }

  all(): Array<{ id: string; value: T; updatedAt: number }> {
    const rows = this.db
      .prepare('SELECT id, value, updated_at FROM kv ORDER BY updated_at DESC')
      .all() as Array<{ id: string; value: string; updated_at: number }>;
    const result: Array<{ id: string; value: T; updatedAt: number }> = [];
    for (const row of rows) {
      try {
        result.push({ id: row.id, value: JSON.parse(row.value) as T, updatedAt: row.updated_at });
      } catch {
        // 跳过损坏记录
      }
    }
    return result;
  }
}

/** 优先 SQLite；初始化失败时降级为内存存储，绝不阻塞启动。 */
export function createPersistentStore<T>(file: string): KeyValueStore<T> {
  try {
    return new SqliteStore<T>(file);
  } catch (err) {
    console.warn('[store] SQLite 初始化失败，已降级为内存存储：', err instanceof Error ? err.message : err);
    return new InMemoryStore<T>();
  }
}
