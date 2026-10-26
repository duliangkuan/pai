import type { Card, GameSnapshot } from '@/types/guandan';

export const SNAPSHOT_STORAGE_KEY = 'guandan:snapshots:v1';
export interface SavedGame {
  snapshot: GameSnapshot;
  cloudSynced: boolean;
}
type SnapshotStorage = Pick<Storage, 'getItem' | 'setItem'>;
const positions = ['SOUTH', 'NORTH', 'EAST', 'WEST'] as const;
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'Small', 'Big'];
const suits = ['Spades', 'Hearts', 'Clubs', 'Diamonds', 'Joker'];
const playTypes = ['Single', 'Pair', 'Triple', 'TripleWithPair', 'Straight', 'StraightFlush', 'Tube', 'Plate', 'Bomb', 'KingBomb', 'Pass', 'Invalid'];

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== 'object') return false;
  const card = value as Card;
  return typeof card.id === 'string' && suits.includes(card.suit) && ranks.includes(card.rank) &&
    Number.isFinite(card.value) && typeof card.isWildcard === 'boolean' &&
    (card.actingAs === undefined || (!!card.actingAs && suits.includes(card.actingAs.suit) && ranks.includes(card.actingAs.rank)));
}

export function isGameSnapshot(value: unknown): value is GameSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snap = value as GameSnapshot;
  return typeof snap.snapshotId === 'string' && snap.snapshotId.length > 0 &&
    Number.isFinite(snap.timestamp) && !!snap.tableState &&
    ranks.includes(snap.tableState.currentLevelRank) &&
    positions.includes(snap.tableState.currentPlayer) &&
    Array.isArray(snap.tableState.actionHistory) && snap.tableState.actionHistory.every(action =>
      action && typeof action.actionId === 'string' && positions.includes(action.playerId) &&
      playTypes.includes(action.playType) && typeof action.isRuleViolation === 'boolean' &&
      Number.isFinite(action.timestamp) && Array.isArray(action.playedCards) && action.playedCards.every(isCard)) &&
    !!snap.playersState &&
    positions.every(pos => snap.playersState[pos]?.position === pos &&
      typeof snap.playersState[pos]?.isRevealed === 'boolean' &&
      Array.isArray(snap.playersState[pos]?.handCards) && snap.playersState[pos].handCards.every(isCard)) &&
    (snap.remark === undefined || typeof snap.remark === 'string') &&
    (snap.organizedGroupsState === undefined || (!!snap.organizedGroupsState && positions.every(pos =>
      Array.isArray(snap.organizedGroupsState?.[pos]) && snap.organizedGroupsState[pos].every(group =>
        group && Array.isArray(group.cardIds) && group.cardIds.every(id => typeof id === 'string') &&
        playTypes.includes(group.type) && Number.isFinite(group.primaryValue) &&
        Number.isFinite(group.length) && typeof group.isBomb === 'boolean'))));
}

// Invalid or full storage must fail visibly; never overwrite unreadable archives.
export function readSavedGames(storage: SnapshotStorage): SavedGame[] {
  const raw = storage.getItem(SNAPSHOT_STORAGE_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(entry => entry &&
    typeof entry.cloudSynced === 'boolean' && isGameSnapshot(entry.snapshot))) {
    throw new Error('本机存档格式异常，请先导出备份，不要清除浏览器数据。');
  }
  return parsed;
}

export function saveLocalGame(storage: SnapshotStorage, snapshot: GameSnapshot, cloudSynced = false): SavedGame[] {
  const entries = readSavedGames(storage);
  const next = [{ snapshot, cloudSynced }, ...entries.filter(entry => entry.snapshot.snapshotId !== snapshot.snapshotId)]
    .sort((a, b) => b.snapshot.timestamp - a.snapshot.timestamp);
  storage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function cacheCloudGames(storage: SnapshotStorage, snapshots: GameSnapshot[]): SavedGame[] {
  const entries = readSavedGames(storage);
  const byId = new Map(entries.map(entry => [entry.snapshot.snapshotId, entry]));
  for (const snapshot of snapshots) {
    const existing = byId.get(snapshot.snapshotId);
    if (!existing || existing.snapshot.timestamp <= snapshot.timestamp) {
      byId.set(snapshot.snapshotId, { snapshot, cloudSynced: true });
    }
  }
  const next = [...byId.values()].sort((a, b) => b.snapshot.timestamp - a.snapshot.timestamp);
  storage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeLocalGame(storage: SnapshotStorage, id: string): SavedGame[] {
  const next = readSavedGames(storage).filter(entry => entry.snapshot.snapshotId !== id);
  storage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function importSavedGames(storage: SnapshotStorage, input: unknown): SavedGame[] {
  const backup = input as { version?: number; snapshots?: unknown[] } | null;
  if (backup?.version !== 1 || !Array.isArray(backup.snapshots) || !backup.snapshots.every(isGameSnapshot)) {
    throw new Error('请选择有效的掼蛋牌局备份文件。');
  }
  const entries = readSavedGames(storage);
  const byId = new Map(entries.map(entry => [entry.snapshot.snapshotId, entry]));
  for (const snapshot of backup.snapshots) {
    const existing = byId.get(snapshot.snapshotId);
    if (!existing || existing.snapshot.timestamp < snapshot.timestamp) {
      byId.set(snapshot.snapshotId, { snapshot, cloudSynced: false });
    }
  }
  const next = [...byId.values()].sort((a, b) => b.snapshot.timestamp - a.snapshot.timestamp);
  storage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function cloudErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/402|quota|exceeded.*limit/i.test(message)) {
    return '云端数据库额度已用尽，请在 Neon 控制台检查额度。本机牌局不受影响。';
  }
  return '暂时无法连接云端，请稍后重试。本机牌局不受影响。';
}
