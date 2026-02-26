'use client';

import React, { useCallback, useEffect, useState, useTransition } from 'react';
import { GameSnapshot } from '@/types/guandan';
import { useGuandanStore } from '@/store/useGuandanStore';
import {
  deleteGameSnapshotFromKV,
  fetchGameSnapshotsFromKV,
  saveGameSnapshotToKV,
} from '@/actions/guandan-kv';

export default function HistoryDrawer() {
  const { table, saveSnapshot, loadSnapshot } = useGuandanStore();

  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<GameSnapshot[]>([]);
  const [remarkInput, setRemarkInput] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── 拉取列表 ────────────────────────────────────────────────
  const fetchList = useCallback(() => {
    startTransition(async () => {
      const list = await fetchGameSnapshotsFromKV();
      setSnapshots(list);
    });
  }, []);

  useEffect(() => {
    if (isOpen) fetchList();
  }, [isOpen, fetchList]);

  // ── 保存到云端 ──────────────────────────────────────────────
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

    setShowSaveModal(false);
    startTransition(async () => {
      const result = await saveGameSnapshotToKV({
        ...latest,
        remark: remarkInput || undefined,
      });
      if (result.success) {
        setStatusMsg('✅ 牌局已保存到云端');
        fetchList();
      } else {
        setStatusMsg(`❌ 保存失败：${result.error}`);
      }
      setTimeout(() => setStatusMsg(null), 3000);
    });
  }

  // ── 加载牌局 ────────────────────────────────────────────────
  function handleLoadSnapshot(snap: GameSnapshot) {
    loadSnapshot(snap);
    setIsOpen(false);
    setStatusMsg('✅ 牌局已加载');
    setTimeout(() => setStatusMsg(null), 2000);
  }

  // ── 删除快照 ────────────────────────────────────────────────
  function handleDeleteSnapshot(id: string) {
    startTransition(async () => {
      await deleteGameSnapshotFromKV(id);
      setSnapshots((prev) => prev.filter((s) => s.snapshotId !== id));
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-2xl border border-gray-700 animate-fade-in">
          {statusMsg}
        </div>
      )}

      {/* ── 悬浮保存按钮（Header 右侧） ────────────────────── */}
      <div className="fixed top-3 right-4 z-50 flex items-center gap-2">
        <button
          onClick={handleSaveClick}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-xl shadow-lg transition-colors font-semibold"
        >
          💾 保存牌局
        </button>
        <button
          onClick={() => setIsOpen(true)}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl shadow-lg transition-colors"
        >
          📂 历史记录
        </button>
      </div>

      {/* ── 保存备注弹窗 ───────────────────────────────────── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-[min(92vw,400px)] shadow-2xl">
            <h3 className="text-white font-bold text-base mb-3">保存牌局到云端</h3>
            <p className="text-gray-400 text-xs mb-3">
              当前打：{table.currentLevelRank} 级
            </p>
            <input
              value={remarkInput}
              onChange={(e) => setRemarkInput(e.target.value)}
              placeholder="输入备注（可选）"
              maxLength={60}
              className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
            />
            <div className="flex gap-2 justify-end">
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

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {isPending && (
            <div className="text-center text-gray-500 text-sm py-8">加载中…</div>
          )}
          {!isPending && snapshots.length === 0 && (
            <div className="text-center text-gray-600 text-sm py-12">
              暂无保存的牌局。<br />
              点击「保存牌局」按钮保存当前局面。
            </div>
          )}
          {snapshots.map((snap) => (
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
                </div>
                <button
                  onClick={() => handleDeleteSnapshot(snap.snapshotId)}
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
            </div>
          ))}
        </div>

        {/* 刷新按钮 */}
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={fetchList}
            disabled={isPending}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm rounded-lg transition-colors"
          >
            🔄 刷新列表
          </button>
        </div>
      </div>
    </>
  );
}
