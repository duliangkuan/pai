'use server';

import { Redis } from '@upstash/redis';
import { GameSnapshot } from '@/types/guandan';

// 创建 Redis 客户端，支持标准 REDIS_URL
const kv = process.env.REDIS_URL 
  ? Redis.fromEnv()
  : new Redis({
      url: process.env.KV_REST_API_URL || '',
      token: process.env.KV_REST_API_TOKEN || '',
    });

const KV_LIST_KEY = 'guandan:snapshots:index';
const KV_SNAP_PREFIX = 'guandan:snapshot:';

/**
 * 将游戏快照存入 Vercel KV（Redis）。
 * 使用 hash 存储快照内容，有序集合存储索引（score = timestamp）。
 */
export async function saveGameSnapshotToKV(
  snapshot: GameSnapshot
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = `${KV_SNAP_PREFIX}${snapshot.snapshotId}`;
    // 存储快照 JSON
    await kv.set(key, JSON.stringify(snapshot));
    // 在有序集合里记录 snapshotId，score = timestamp（用于时间排序）
    await kv.zadd(KV_LIST_KEY, {
      score: snapshot.timestamp,
      member: snapshot.snapshotId,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message };
  }
}

/**
 * 拉取所有历史快照摘要列表，按时间降序排列。
 */
export async function fetchGameSnapshotsFromKV(): Promise<GameSnapshot[]> {
  try {
    // 按 score 降序拉取所有 snapshotId
    const ids = await kv.zrange(KV_LIST_KEY, 0, -1, { rev: true });
    if (!ids || ids.length === 0) return [];

    const snapshots: GameSnapshot[] = [];
    for (const id of ids) {
      const raw = await kv.get<string>(`${KV_SNAP_PREFIX}${id}`);
      if (raw) {
        try {
          const snap = JSON.parse(raw) as GameSnapshot;
          snapshots.push(snap);
        } catch {
          // 跳过解析失败的记录
        }
      }
    }
    return snapshots;
  } catch {
    return [];
  }
}

/**
 * 删除指定快照（可选功能）。
 */
export async function deleteGameSnapshotFromKV(
  snapshotId: string
): Promise<{ success: boolean }> {
  try {
    await kv.del(`${KV_SNAP_PREFIX}${snapshotId}`);
    await kv.zrem(KV_LIST_KEY, snapshotId);
    return { success: true };
  } catch {
    return { success: false };
  }
}
