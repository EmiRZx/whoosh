import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ResponseCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export class MemoryCache implements ResponseCache {
  private entries = new Map<string, unknown>();

  constructor(private maxEntries = 5000) {}

  async get(key: string) {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    // Re-insert so the Map's insertion order doubles as LRU order.
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  async set(key: string, value: unknown) {
    this.entries.set(key, value);
    if (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }
}

// One JSON file per response. The directory must stay out of git: Qloo's
// hackathon terms forbid storing its data in a public repository.
export class FileCache implements ResponseCache {
  constructor(private dir: string) {}

  private file(key: string) {
    return path.join(this.dir, `${createHash("sha256").update(key).digest("hex")}.json`);
  }

  async get(key: string) {
    try {
      return JSON.parse(await readFile(this.file(key), "utf8"));
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown) {
    // A read-only filesystem (some hosts) just means no disk cache.
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(this.file(key), JSON.stringify(value));
    } catch {}
  }
}

// Memory in front of a slower store; disk hits are promoted to memory.
export class TieredCache implements ResponseCache {
  constructor(private tiers: ResponseCache[]) {}

  async get(key: string) {
    for (const [i, tier] of this.tiers.entries()) {
      const value = await tier.get(key);
      if (value !== undefined) {
        await Promise.all(this.tiers.slice(0, i).map((t) => t.set(key, value)));
        return value;
      }
    }
    return undefined;
  }

  async set(key: string, value: unknown) {
    await Promise.all(this.tiers.map((t) => t.set(key, value)));
  }
}

// A shared, durable tier for hosted deployments: every server instance sees
// the same responses, and they survive restarts and redeploys.
export class RedisCache implements ResponseCache {
  constructor(
    private store: { get(key: string): Promise<string | null>; set(key: string, value: string, ttlSeconds: number): Promise<void> },
    private ttlSeconds = 90 * 86_400,
  ) {}

  private key(key: string) {
    return `whoosh:qloo:${createHash("sha256").update(key).digest("hex")}`;
  }

  async get(key: string) {
    try {
      const raw = await this.store.get(this.key(key));
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown) {
    try {
      await this.store.set(this.key(key), JSON.stringify(value), this.ttlSeconds);
    } catch {}
  }
}
