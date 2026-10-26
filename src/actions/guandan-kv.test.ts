import { afterEach, describe, expect, it, vi } from 'vitest';
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('@neondatabase/serverless', () => ({ neon: () => sql }));
import { deleteGameSnapshotFromKV, fetchGameSnapshotsFromKV, saveGameSnapshotToKV } from './guandan-kv';
import { useGuandanStore } from '@/store/useGuandanStore';

afterEach(() => { sql.mockReset(); vi.unstubAllEnvs(); });
function enableDb() { vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/test'); }

describe('cloud storage failures and bounded reads', () => {
  it('keeps quota errors distinguishable from an empty history', async () => {
    enableDb();
    sql.mockRejectedValue(new Error('HTTP 402 quota exceeded'));
    const result = await fetchGameSnapshotsFromKV();
    expect(result.success).toBe(false);
    expect(result.error).toContain('额度已用尽');
    expect(sql).toHaveBeenCalledTimes(1);
  });
  it('returns 50 games and a continuation flag, without a CREATE TABLE request', async () => {
    enableDb();
    sql.mockResolvedValue(Array.from({ length: 51 }, (_, index) => ({ data: { snapshotId: String(index) } })));
    const result = await fetchGameSnapshotsFromKV(50);
    expect(result.success).toBe(true);
    expect(result.snapshots).toHaveLength(50);
    expect(result.hasMore).toBe(true);
    expect(sql.mock.calls[0][0].join('')).toContain('LIMIT 51 OFFSET');
    expect(sql).toHaveBeenCalledTimes(1);
  });
  it('does not claim deletion succeeded when the database rejects it', async () => {
    enableDb();
    sql.mockRejectedValue(new Error('HTTP 402 quota exceeded'));
    expect((await deleteGameSnapshotFromKV('existing')).success).toBe(false);
  });
  it('rejects invalid pagination without querying the database', async () => {
    enableDb();
    expect((await fetchGameSnapshotsFromKV(-1)).success).toBe(false);
    expect(sql).not.toHaveBeenCalled();
  });
  it('writes the same snapshot id with an upsert so retries do not create duplicates', async () => {
    enableDb();
    sql.mockResolvedValue([]);
    useGuandanStore.getState().saveSnapshot('test');
    const stack = useGuandanStore.getState().historyStack;
    const game = stack[stack.length - 1];
    expect((await saveGameSnapshotToKV(game)).success).toBe(true);
    expect(sql.mock.calls[0][0].join('')).toContain('ON CONFLICT (snapshot_id) DO UPDATE');
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
