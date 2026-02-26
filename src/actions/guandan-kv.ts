'use server';

import { Redis } from '@upstash/redis';
import { createClient } from 'redis';
import { GameSnapshot } from '@/types/guandan';

const KV_LIST_KEY = 'guandan:snapshots:index';
const KV_SNAP_PREFIX = 'guandan:snapshot:';

type KVClient = 'upstash' | 'node-redis';

/** 判断使用哪种 Redis 客户端 */
function getClientType(): KVClient | null {
  const redisUrl = process.env.REDIS_URL || '';
  const kvUrl = process.env.KV_REST_API_URL || '';
  if (redisUrl && (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://'))) {
    return 'node-redis';
  }
  if (kvUrl && kvUrl.startsWith('http')) {
    return 'upstash';
  }
  return null;
}

/** 使用 Upstash REST API（KV_REST_API_URL） */
async function saveWithUpstash(snapshot: GameSnapshot): Promise<{ success: boolean; error?: string }> {
  const kv = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN || '',
  });
  const key = `${KV_SNAP_PREFIX}${snapshot.snapshotId}`;
  await kv.set(key, JSON.stringify(snapshot));
  await kv.zadd(KV_LIST_KEY, { score: snapshot.timestamp, member: snapshot.snapshotId });
  return { success: true };
}

/** 使用 node-redis（REDIS_URL，支持 redis:// 协议） */
async function saveWithNodeRedis(snapshot: GameSnapshot): Promise<{ success: boolean; error?: string }> {
  const url = process.env.REDIS_URL!;
  const isRedisCloud = url.includes('redislabs.com') || url.includes('redis.cloud');
  const client = createClient({
    url,
    socket: isRedisCloud ? { tls: true, rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  try {
    const key = `${KV_SNAP_PREFIX}${snapshot.snapshotId}`;
    await client.set(key, JSON.stringify(snapshot));
    await client.zAdd(KV_LIST_KEY, { score: snapshot.timestamp, value: snapshot.snapshotId });
    return { success: true };
  } finally {
    await client.quit();
  }
}

/**
 * 将游戏快照存入 Redis。
 * 支持 REDIS_URL（redis://）或 KV_REST_API_URL（Upstash HTTP）
 */
export async function saveGameSnapshotToKV(
  snapshot: GameSnapshot
): Promise<{ success: boolean; error?: string }> {
  const clientType = getClientType();
  if (!clientType) {
    return {
      success: false,
      error: 'Redis 未配置：请设置 REDIS_URL（redis://）或 KV_REST_API_URL（Vercel KV）',
    };
  }
  try {
    return clientType === 'upstash' ? await saveWithUpstash(snapshot) : await saveWithNodeRedis(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message };
  }
}

/** 使用 Upstash 拉取列表 */
async function fetchWithUpstash(): Promise<GameSnapshot[]> {
  const kv = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN || '',
  });
  const ids = await kv.zrange(KV_LIST_KEY, 0, -1, { rev: true });
  if (!ids?.length) return [];
  const snapshots: GameSnapshot[] = [];
  for (const id of ids) {
    const raw = await kv.get<string>(`${KV_SNAP_PREFIX}${id}`);
    if (raw) {
      try {
        snapshots.push(JSON.parse(raw) as GameSnapshot);
      } catch {
        /* skip */
      }
    }
  }
  return snapshots;
}

/** 使用 node-redis 拉取列表 */
async function fetchWithNodeRedis(): Promise<GameSnapshot[]> {
  const url = process.env.REDIS_URL!;
  const isRedisCloud = url.includes('redislabs.com') || url.includes('redis.cloud');
  const client = createClient({
    url,
    socket: isRedisCloud ? { tls: true, rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  try {
    const ids = await client.zRange(KV_LIST_KEY, 0, -1, { REV: true });
    if (!ids?.length) return [];
    const snapshots: GameSnapshot[] = [];
    for (const id of ids) {
      const raw = await client.get(`${KV_SNAP_PREFIX}${id}`);
      if (raw) {
        try {
          snapshots.push(JSON.parse(raw) as GameSnapshot);
        } catch {
          /* skip */
        }
      }
    }
    return snapshots;
  } finally {
    await client.quit();
  }
}

export async function fetchGameSnapshotsFromKV(): Promise<GameSnapshot[]> {
  const clientType = getClientType();
  if (!clientType) return [];
  try {
    return clientType === 'upstash' ? await fetchWithUpstash() : await fetchWithNodeRedis();
  } catch {
    return [];
  }
}

/** 使用 Upstash 删除 */
async function deleteWithUpstash(snapshotId: string): Promise<boolean> {
  const kv = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN || '',
  });
  await kv.del(`${KV_SNAP_PREFIX}${snapshotId}`);
  await kv.zrem(KV_LIST_KEY, snapshotId);
  return true;
}

/** 使用 node-redis 删除 */
async function deleteWithNodeRedis(snapshotId: string): Promise<boolean> {
  const url = process.env.REDIS_URL!;
  const isRedisCloud = url.includes('redislabs.com') || url.includes('redis.cloud');
  const client = createClient({
    url,
    socket: isRedisCloud ? { tls: true, rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  try {
    await client.del(`${KV_SNAP_PREFIX}${snapshotId}`);
    await client.zRem(KV_LIST_KEY, snapshotId);
    return true;
  } finally {
    await client.quit();
  }
}

export async function deleteGameSnapshotFromKV(snapshotId: string): Promise<{ success: boolean }> {
  const clientType = getClientType();
  if (!clientType) return { success: false };
  try {
    const ok =
      clientType === 'upstash' ? await deleteWithUpstash(snapshotId) : await deleteWithNodeRedis(snapshotId);
    return { success: ok };
  } catch {
    return { success: false };
  }
}
