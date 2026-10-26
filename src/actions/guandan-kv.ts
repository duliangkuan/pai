'use server';

import { neon } from '@neondatabase/serverless';
import type { GameSnapshot } from '@/types/guandan';
import { cloudErrorMessage, isGameSnapshot } from '@/utils/snapshotStorage';

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('Database unavailable');
  return neon(url);
}

// The existing table is initialized once, not on every request.
export async function saveGameSnapshotToKV(snapshot: GameSnapshot): Promise<{ success: boolean; error?: string }> {
  if (!isGameSnapshot(snapshot) || snapshot.snapshotId.length > 255 ||
    (snapshot.remark !== undefined && (typeof snapshot.remark !== 'string' || snapshot.remark.length > 60)) ||
    JSON.stringify(snapshot).length > 512_000) {
    return { success: false, error: '牌局格式无效或过大，请先导出本机备份。' };
  }
  try {
    const sql = getSql();
    await sql`
      INSERT INTO guandan_snapshots (snapshot_id, timestamp, data, remark)
      VALUES (${snapshot.snapshotId}, ${snapshot.timestamp}, ${JSON.stringify(snapshot)}::jsonb, ${snapshot.remark ?? null})
      ON CONFLICT (snapshot_id) DO UPDATE SET timestamp = EXCLUDED.timestamp, data = EXCLUDED.data, remark = EXCLUDED.remark
    `;
    return { success: true };
  } catch (err) {
    return { success: false, error: cloudErrorMessage(err) };
  }
}

export async function fetchGameSnapshotsFromKV(offset = 0): Promise<{
  success: boolean; snapshots: GameSnapshot[]; hasMore: boolean; error?: string;
}> {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) {
    return { success: false, snapshots: [], hasMore: false, error: '分页参数无效。' };
  }
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT data FROM guandan_snapshots ORDER BY timestamp DESC, snapshot_id DESC LIMIT 51 OFFSET ${offset}
    `;
    return { success: true, snapshots: rows.slice(0, 50).map(row => row.data as GameSnapshot), hasMore: rows.length > 50 };
  } catch (err) {
    return { success: false, snapshots: [], hasMore: false, error: cloudErrorMessage(err) };
  }
}

export async function deleteGameSnapshotFromKV(snapshotId: string): Promise<{ success: boolean; error?: string }> {
  if (typeof snapshotId !== 'string' || !snapshotId || snapshotId.length > 255) {
    return { success: false, error: '牌局编号无效。' };
  }
  try {
    const sql = getSql();
    await sql`DELETE FROM guandan_snapshots WHERE snapshot_id = ${snapshotId}`;
    return { success: true };
  } catch (err) {
    return { success: false, error: cloudErrorMessage(err) };
  }
}
