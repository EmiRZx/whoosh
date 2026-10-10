// Caps on live analyses, which call Claude several times each. The built-in
// examples replay recorded model output and are never limited.
import { hasRedis, pipeline } from "./store/redis";

const PER_IP_PER_HOUR = Number(process.env.LIVE_PER_IP_PER_HOUR) || 8;
const PER_DAY = Number(process.env.LIVE_PER_DAY) || 150;

const memory = new Map<string, { count: number; resets: number }>();

async function bump(key: string, ttlSeconds: number): Promise<number> {
  if (hasRedis) {
    const [count] = await pipeline<[number, number]>([
      ["INCR", key],
      ["EXPIRE", key, ttlSeconds],
    ]);
    return count;
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resets <= now) {
    memory.set(key, { count: 1, resets: now + ttlSeconds * 1000 });
    return 1;
  }
  entry.count++;
  return entry.count;
}

export type LimitResult = { ok: true } | { ok: false; message: string };

export async function takeLiveSlot(ip: string): Promise<LimitResult> {
  const hour = Math.floor(Date.now() / 3_600_000);
  const day = new Date().toISOString().slice(0, 10);
  try {
    if ((await bump(`whoosh:live:ip:${ip}:${hour}`, 3600)) > PER_IP_PER_HOUR) {
      return { ok: false, message: "You've checked a lot of scripts this hour. Try again in a little while, or explore the examples." };
    }
    if ((await bump(`whoosh:live:day:${day}`, 86_400)) > PER_DAY) {
      return { ok: false, message: "Today's live checks are used up. The examples still work, and live checks reopen tomorrow." };
    }
  } catch (err) {
    // A broken limiter shouldn't take the demo down.
    console.error("rate limiter failed", err);
  }
  return { ok: true };
}

// Qloo-only lookups (performer search) are cheap but share the Qloo quota.
const QLOO_PER_IP_PER_HOUR = 300;

export async function takeLookupSlot(ip: string): Promise<boolean> {
  try {
    return (await bump(`whoosh:lookup:ip:${ip}:${Math.floor(Date.now() / 3_600_000)}`, 3600)) <= QLOO_PER_IP_PER_HOUR;
  } catch {
    return true;
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
