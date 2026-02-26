'use server';

import { neon } from '@neondatabase/serverless';
import { GameSnapshot } from '@/types/guandan';

function getDbUrl(): string | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (url && (url.startsWith('postgresql://') || url.startsWith('postgres://'))) {
    return url;
  }
  return null;
}

/** 确保 guandan_snapshots 表存在（首次使用时自动建表） */
async function ensureTable(dbUrl: string) {
  const sql = neon(dbUrl);
  await sql`
    CREATE TABLE IF NOT EXISTS guandan_snapshots (
      snapshot_id VARCHAR(255) PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      data JSONB NOT NULL,
      remark VARCHAR(255)
    )
  `;
}

/** 将游戏快照存入 Neon PostgreSQL */
export async function saveGameSnapshotToKV(
  snapshot: GameSnapshot
): Promise<{ success: boolean; error?: string }> {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    return {
      success: false,
      error: '存储未配置：请设置 DATABASE_URL（Neon PostgreSQL）',
    };
  }
  try {
    const sql = neon(dbUrl);
    await ensureTable(dbUrl);
    await sql`
      INSERT INTO guandan_snapshots (snapshot_id, timestamp, data, remark)
      VALUES (${snapshot.snapshotId}, ${snapshot.timestamp}, ${JSON.stringify(snapshot)}::jsonb, ${snapshot.remark ?? null})
      ON CONFLICT (snapshot_id) DO UPDATE SET timestamp = EXCLUDED.timestamp, data = EXCLUDED.data, remark = EXCLUDED.remark
    `;
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message };
  }
}

/** 从 Neon 拉取牌局快照列表 */
export async function fetchGameSnapshotsFromKV(): Promise<GameSnapshot[]> {
  const dbUrl = getDbUrl();
  if (!dbUrl) return [];
  try {
    const sql = neon(dbUrl);
    await ensureTable(dbUrl);
    const rows = await sql`
      SELECT data FROM guandan_snapshots ORDER BY timestamp DESC
    `;
    return rows.map((r) => r.data as GameSnapshot);
  } catch {
    return [];
  }
}

/** 从 Neon 删除指定牌局快照 */
export async function deleteGameSnapshotFromKV(snapshotId: string): Promise<{ success: boolean }> {
  const dbUrl = getDbUrl();
  if (!dbUrl) return { success: false };
  try {
    const sql = neon(dbUrl);
    await ensureTable(dbUrl);
    await sql`DELETE FROM guandan_snapshots WHERE snapshot_id = ${snapshotId}`;
    return { success: true };
  } catch {
    return { success: false };
  }
}
