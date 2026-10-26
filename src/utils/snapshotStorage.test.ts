import { describe, expect, it } from 'vitest';
import { useGuandanStore } from '@/store/useGuandanStore';
import { cacheCloudGames, cloudErrorMessage, importSavedGames, readSavedGames, removeLocalGame, saveLocalGame, SNAPSHOT_STORAGE_KEY } from './snapshotStorage';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
function snapshot(id = 'test', timestamp = 100) {
  useGuandanStore.getState().saveSnapshot('持久保存测试');
  const stack = useGuandanStore.getState().historyStack;
  return { ...stack[stack.length - 1], snapshotId: id, timestamp };
}

describe('durable local snapshots', () => {
  it('restores the complete game from a new storage reader after a reload', () => {
    const storage = memoryStorage();
    const game = snapshot();
    saveLocalGame(storage, game);
    const reopenedStorage = { getItem: storage.getItem, setItem: storage.setItem };
    expect(readSavedGames(reopenedStorage)).toEqual([{ snapshot: game, cloudSynced: false }]);
  });
  it('retains pending local games when cloud data is empty and deduplicates repeated syncs', () => {
    const storage = memoryStorage();
    const game = snapshot();
    saveLocalGame(storage, game);
    expect(cacheCloudGames(storage, [])).toHaveLength(1);
    cacheCloudGames(storage, [game]);
    expect(cacheCloudGames(storage, [game])).toEqual([{ snapshot: game, cloudSynced: true }]);
  });
  it('does not replace a newer pending local snapshot with an older cloud copy', () => {
    const storage = memoryStorage();
    saveLocalGame(storage, snapshot('test', 200));
    expect(cacheCloudGames(storage, [snapshot('test', 100)])[0].snapshot.timestamp).toBe(200);
    expect(readSavedGames(storage)[0].cloudSynced).toBe(false);
  });
  it('reports full storage and preserves the existing archive', () => {
    const storage = memoryStorage();
    saveLocalGame(storage, snapshot('old'));
    const before = storage.getItem(SNAPSHOT_STORAGE_KEY);
    const fullStorage = { ...storage, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(() => saveLocalGame(fullStorage, snapshot('new'))).toThrow();
    expect(storage.getItem(SNAPSHOT_STORAGE_KEY)).toBe(before);
  });
  it('does not erase corrupted storage on save or cloud refresh', () => {
    const storage = memoryStorage();
    storage.setItem(SNAPSHOT_STORAGE_KEY, 'corrupted');
    expect(() => saveLocalGame(storage, snapshot())).toThrow();
    expect(() => cacheCloudGames(storage, [])).toThrow();
    expect(storage.getItem(SNAPSHOT_STORAGE_KEY)).toBe('corrupted');
  });
  it('imports exported backups atomically, preserving newer existing games', () => {
    const storage = memoryStorage();
    saveLocalGame(storage, snapshot('same', 200), true);
    const backup = JSON.parse(JSON.stringify({ version: 1, snapshots: [snapshot('same', 100), snapshot('imported', 300)] }));
    const result = importSavedGames(storage, backup);
    expect(result.map(entry => entry.snapshot.snapshotId)).toEqual(['imported', 'same']);
    expect(result[1].snapshot.timestamp).toBe(200);
    expect(result[1].cloudSynced).toBe(true);
    expect(result[0].cloudSynced).toBe(false);
    const before = storage.getItem(SNAPSHOT_STORAGE_KEY);
    expect(() => importSavedGames(storage, { version: 1, snapshots: [snapshot('valid'), {}] })).toThrow();
    expect(storage.getItem(SNAPSHOT_STORAGE_KEY)).toBe(before);
  });
  it('deletes only the selected local game', () => {
    const storage = memoryStorage();
    saveLocalGame(storage, snapshot('keep'));
    saveLocalGame(storage, snapshot('remove'));
    expect(removeLocalGame(storage, 'remove').map(entry => entry.snapshot.snapshotId)).toEqual(['keep']);
  });
  it('returns short actionable cloud errors without exposing raw infrastructure details', () => {
    expect(cloudErrorMessage(new Error('HTTP 402: Your account or project has exceeded the quota'))).toContain('额度已用尽');
    expect(cloudErrorMessage(new Error('private-host password=secret'))).not.toContain('secret');
  });
});
