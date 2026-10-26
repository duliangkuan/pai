'use client';

import React, { useCallback, useEffect, useState, useTransition } from 'react';
import { GameSnapshot, PlayAction, PlayTypeName } from '@/types/guandan';
import { useGuandanStore } from '@/store/useGuandanStore';
import {
  deleteGameSnapshotFromKV,
  fetchGameSnapshotsFromKV,
  saveGameSnapshotToKV,
} from '@/actions/guandan-kv';
import CardTile from './CardTile';
import { cacheCloudGames, importSavedGames, readSavedGames, removeLocalGame, saveLocalGame, SNAPSHOT_STORAGE_KEY, type SavedGame } from '@/utils/snapshotStorage';

const PLAY_TYPE_LABEL: Record<PlayTypeName, string> = {
  Single: '单张',
  Pair: '对子',
  Triple: '三同张',
  TripleWithPair: '三带二',
  Straight: '顺子',
  StraightFlush: '同花顺',
  Tube: '三连对',
  Plate: '钢板',
  Bomb: '炸弹',
  KingBomb: '四大天王',
  Pass: '不出',
  Invalid: '非法牌型',
};

const POSITION_ZH = { SOUTH: '南家', NORTH: '北家', EAST: '东家', WEST: '西家' } as const;

export default function HistoryDrawer() {
  const { table, saveSnapshot, loadSnapshot, clearPlayHistory } = useGuandanStore();

  const [isOpen, setIsOpen] = useState(false);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudOffset, setCloudOffset] = useState(0);
  const [hasMoreCloud, setHasMoreCloud] = useState(false);
  const [remarkInput, setRemarkInput] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPlayRecordModal, setShowPlayRecordModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshLocal = useCallback(() => {
    try {
      setSavedGames(readSavedGames(window.localStorage));
      setStorageError(null);
    } catch {
      setStorageError('无法读取本机存档。请先导出备份，并检查浏览器是否允许本地存储。');
    }
  }, []);

  useEffect(() => {
    refreshLocal();
    function onStorage(event: StorageEvent) {
      if (event.key === SNAPSHOT_STORAGE_KEY || event.key === null) refreshLocal();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshLocal]);

  function fetchCloud(offset = 0) {
    startTransition(async () => {
      try {
        const result = await fetchGameSnapshotsFromKV(offset);
        if (!result.success) {
          setCloudError(result.error || '读取云端失败，本机存档已保留。');
          return;
        }
        setSavedGames(cacheCloudGames(window.localStorage, result.snapshots));
        setCloudOffset(offset + result.snapshots.length);
        setHasMoreCloud(result.hasMore);
        setCloudError(null);
        setStorageError(null);
        setStatusMsg(`已读取 ${result.snapshots.length} 条云端牌局，并保存到本机。`);
      } catch {
        setCloudError('读取云端或写入本机失败。请检查网络和本机存储，已有存档不会被清空。');
      }
    });
  }

  // ── 本机优先保存；云端同步由用户手动触发 ─────────────────────
  function handleSaveClick() {
    setRemarkInput('');
    setShowSaveModal(true);
  }

  async function handleConfirmSave() {
    // 先生成本地快照
    saveSnapshot(remarkInput || undefined);
    const state = useGuandanStore.getState();
    const latest = state.historyStack[state.historyStack.length - 1];
    if (!latest) return;

    try {
      setSavedGames(saveLocalGame(window.localStorage, latest));
      setStorageError(null);
      setShowSaveModal(false);
      setStatusMsg('✅ 牌局已保存到本机，刷新后仍可在历史记录中加载。');
    } catch {
      setStorageError('本机保存失败：存储空间不足、被禁用或存档异常。请先导出当前牌局。');
    }
  }

  function syncGame(snap: GameSnapshot) {
    startTransition(async () => {
      try {
        const result = await saveGameSnapshotToKV(snap);
        if (!result.success) {
          setCloudError(result.error || '同步失败，本机牌局已保留。');
          return;
        }
        setSavedGames(saveLocalGame(window.localStorage, snap, true));
        setCloudError(null);
        setStatusMsg('✅ 此牌局已同步到云端。');
      } catch {
        setCloudError('同步未完成，请稍后重试。本机牌局已保留。');
      }
    });
  }

  function downloadBackup(currentOnly = false) {
    try {
      const data = currentOnly ? {
        version: 1,
        snapshots: [{
          snapshotId: `snap-${Date.now()}-export`, timestamp: Date.now(),
          playersState: useGuandanStore.getState().players,
          tableState: useGuandanStore.getState().table,
          organizedGroupsState: useGuandanStore.getState().organizedGroups,
          remark: remarkInput || undefined,
        }],
      } : { version: 1, snapshots: readSavedGames(window.localStorage).map(entry => entry.snapshot) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `掼蛋牌局-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatusMsg('✅ 已导出牌局文件。');
    } catch {
      setStatusMsg('导出失败，请保留当前页面并检查浏览器存储设置。');
    }
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('备份文件超过 10 MB，请拆分后导入。');
      setSavedGames(importSavedGames(window.localStorage, JSON.parse(await file.text())));
      setStorageError(null);
      setStatusMsg('✅ 已导入本机存档，已有较新的牌局会保留。');
    } catch {
      setStatusMsg('导入失败：文件格式无效、超过 10 MB，或本机存储不可用。原有存档已保留。');
    }
  }

  // ── 加载牌局 ────────────────────────────────────────────────
  function handleLoadSnapshot(snap: GameSnapshot) {
    loadSnapshot(snap);
    setIsOpen(false);
    setStatusMsg('✅ 牌局已加载');
    setTimeout(() => setStatusMsg(null), 2000);
  }

  // ── 删除快照 ────────────────────────────────────────────────
  function handleDeleteSnapshot(entry: SavedGame) {
    if (!window.confirm(entry.cloudSynced ? '确定删除此牌局的本机和云端存档？' : '确定删除此本机牌局？')) return;
    startTransition(async () => {
      try {
        if (entry.cloudSynced) {
          const result = await deleteGameSnapshotFromKV(entry.snapshot.snapshotId);
          if (!result.success) {
            setCloudError(result.error || '云端删除失败，牌局已保留。');
            return;
          }
        }
        setSavedGames(removeLocalGame(window.localStorage, entry.snapshot.snapshotId));
        setStatusMsg('✅ 牌局已删除。');
      } catch {
        setStatusMsg('删除未完成，请刷新本机列表确认，或稍后重试。');
      }
    });
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <>
      {/* ── 状态提示 Toast ─────────────────────────────────── */}
      {statusMsg && (
        <div role="status" className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] w-[min(90vw,480px)] bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-2xl border border-gray-700 break-words" onClick={() => setStatusMsg(null)}>
          {statusMsg}
        </div>
      )}

      {/* ── 悬浮按钮（Header 右侧） ─────────────────────────── */}
      <div className={`fixed top-3 right-4 z-[100] ${isOpen ? 'hidden' : 'flex'} items-center gap-2 flex-shrink-0`}>
        <button
          onClick={() => {
            clearPlayHistory();
            setStatusMsg('✅ 出牌记录已清空');
            setTimeout(() => setStatusMsg(null), 2000);
          }}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl shadow-lg transition-colors"
        >
          🗑️ 清空记录
        </button>
        <button
          onClick={() => setShowPlayRecordModal(true)}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl shadow-lg transition-colors"
        >
          📋 出牌记录
        </button>
        <button
          onClick={handleSaveClick}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-xl shadow-lg transition-colors font-semibold"
        >
          💾 保存牌局
        </button>
        <button
          onClick={() => { refreshLocal(); setIsOpen(true); }}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl shadow-lg transition-colors"
        >
          📂 历史记录
        </button>
      </div>

      {/* ── 出牌记录弹窗 ───────────────────────────────────── */}
      {showPlayRecordModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60"
          onClick={() => setShowPlayRecordModal(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-4 w-[min(92vw,420px)] max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-base">📋 本局出牌记录</h3>
              <button
                onClick={() => setShowPlayRecordModal(false)}
                className="text-gray-400 hover:text-white text-xl transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 py-1">
              {table.actionHistory.length === 0 ? (
                <span className="text-gray-500 text-sm italic">暂无出牌记录</span>
              ) : (
                table.actionHistory.map((action: PlayAction) => (
                  <div
                    key={action.actionId}
                    className={[
                      'flex flex-col items-center gap-1 p-2 rounded-lg',
                      action.isRuleViolation ? 'bg-red-900/30 ring-2 ring-red-500' : 'bg-gray-800',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'text-base px-2.5 py-1 rounded-full font-semibold',
                        action.isRuleViolation ? 'bg-red-600 text-white' : 'bg-green-700/60 text-green-200',
                      ].join(' ')}
                    >
                      {POSITION_ZH[action.playerId]} · {PLAY_TYPE_LABEL[action.playType]}
                      {action.isRuleViolation ? ' ⚠️违规' : ''}
                    </span>
                    {action.playedCards.length > 0 ? (
                      <div className="flex flex-row flex-wrap justify-center gap-1">
                        {action.playedCards.map((card) => (
                          <CardTile
                            key={card.id}
                            card={card}
                            levelRank={table.currentLevelRank}
                            size="sm"
                            layoutMode="corner-only"
                            ruleViolation={action.isRuleViolation}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm italic">不出</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 保存备注弹窗 ───────────────────────────────────── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-[min(92vw,400px)] shadow-2xl">
            <h3 className="text-white font-bold text-base mb-3">保存牌局到本机</h3>
            <p className="text-gray-400 text-xs mb-3">
              当前打：{table.currentLevelRank} 级。无需连接云端；可在历史记录中手动同步。
            </p>
            {storageError && <p role="alert" className="text-amber-300 text-sm mb-3">{storageError}</p>}
            <input
              value={remarkInput}
              onChange={(e) => setRemarkInput(e.target.value)}
              placeholder="输入备注（可选）"
              maxLength={60}
              className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => downloadBackup(true)} className="text-blue-300 text-sm mr-auto">导出当前牌局</button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={isPending}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded-lg font-semibold"
              >
                {isPending ? '保存中…' : '确认保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 历史记录抽屉 ────────────────────────────────────── */}
      {/* 背景遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={[
          'fixed top-0 right-0 h-full w-[min(92vw,380px)] bg-gray-900 border-l border-gray-700 z-[75] shadow-2xl transition-transform duration-300 flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* 抽屉标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-white font-bold text-base">📂 历史牌局</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white text-xl transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 text-xs text-gray-400 border-b border-gray-700 space-y-2">
          <p>本机存档仅在当前浏览器可用，清除网站数据会丢失。建议定期导出备份。</p>
          <p>云端受限时仍可保存、加载本机牌局。旧云端存档可点击下方「读取云端」获取。</p>
          {storageError && <p role="alert" className="text-amber-300">{storageError}</p>}
          {cloudError && <p role="alert" className="text-amber-300">{cloudError}</p>}
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {isPending && (
            <div className="text-center text-gray-500 text-sm py-8">加载中…</div>
          )}
          {!isPending && !storageError && savedGames.length === 0 && (
            <div className="text-center text-gray-600 text-sm py-12">
              本机暂无保存的牌局。<br />
              点击「保存牌局」按钮保存当前局面。
            </div>
          )}
          {savedGames.map((entry) => { const snap = entry.snapshot; return (
            <div
              key={snap.snapshotId}
              className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-white text-sm font-semibold">
                    {snap.remark || '（无备注）'}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {formatTime(snap.timestamp)} · 打 {snap.tableState.currentLevelRank}
                  </p>
                  <p className="text-xs text-green-300 mt-1">{entry.cloudSynced ? '本机已保存 · 已同步云端' : '本机已保存 · 未同步云端'}</p>
                </div>
                <button
                  onClick={() => handleDeleteSnapshot(entry)}
                  disabled={isPending}
                  className="text-gray-600 hover:text-red-400 text-xs transition-colors mt-0.5 shrink-0"
                  title="删除"
                >
                  🗑️
                </button>
              </div>
              {/* 手牌数量摘要 */}
              <div className="flex gap-2 text-xs text-gray-400">
                {(['SOUTH', 'NORTH', 'EAST', 'WEST'] as const).map((pos) => (
                  <span key={pos} className="bg-gray-700 px-2 py-0.5 rounded-full">
                    {pos === 'SOUTH' ? '南' : pos === 'NORTH' ? '北' : pos === 'EAST' ? '东' : '西'}
                    {snap.playersState[pos].handCards.length}
                  </span>
                ))}
              </div>
              <button
                onClick={() => handleLoadSnapshot(snap)}
                className="w-full py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors font-semibold"
              >
                加载此牌局 →
              </button>
              {!entry.cloudSynced && <button onClick={() => syncGame(snap)} disabled={isPending} className="text-xs text-gray-300 disabled:opacity-50 py-1">同步此牌局到云端</button>}
            </div>
          ); })}
          {hasMoreCloud && <button onClick={() => fetchCloud(cloudOffset)} disabled={isPending} className="text-blue-300 text-sm disabled:opacity-50">读取更多云端牌局</button>}
        </div>

        {/* 刷新按钮 */}
        <div className="p-3 border-t border-gray-700 grid grid-cols-2 gap-2">
          <button
            onClick={refreshLocal}
            disabled={isPending}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm rounded-lg transition-colors"
          >
            刷新本机
          </button>
          <button onClick={() => fetchCloud()} disabled={isPending} className="text-sm text-gray-300 bg-gray-700 rounded-lg disabled:opacity-50">读取云端</button>
          <button onClick={() => downloadBackup()} className="text-sm text-blue-300 py-2">导出备份</button>
          <label className="text-sm text-blue-300 py-2 text-center cursor-pointer">导入备份<input type="file" accept="application/json,.json" onChange={importBackup} className="hidden" /></label>
        </div>
      </div>
    </>
  );
}
