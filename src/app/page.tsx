'use client';

import React, { useState } from 'react';
import { useGuandanStore } from '@/store/useGuandanStore';
import SetupMatrixPanel from '@/components/SetupMatrixPanel';
import MainTable from '@/components/MainTable';
import HistoryDrawer from '@/components/HistoryDrawer';

type Tab = 'setup' | 'table';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('setup');
  const { isSetupMode, toggleSetupMode, table } = useGuandanStore();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── 顶部导航栏 ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-4 py-2.5 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🀄</span>
          <div>
            <h1 className="text-white font-extrabold text-base leading-tight">掼蛋教学工具</h1>
            <p className="text-gray-500 text-[10px] leading-tight">
              当前打 <span className="text-yellow-400 font-bold">{table.currentLevelRank}</span> ·
              逢人配 <span className="text-yellow-400 font-bold">♥{table.currentLevelRank}</span>
            </p>
          </div>
        </div>

        {/* 标签页切换 */}
        <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('setup')}
            className={[
              'px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'setup'
                ? 'bg-yellow-500 text-gray-900 shadow'
                : 'text-gray-400 hover:text-white',
            ].join(' ')}
          >
            ⚙️ 排牌设置
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={[
              'px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'table'
                ? 'bg-green-600 text-white shadow'
                : 'text-gray-400 hover:text-white',
            ].join(' ')}
          >
            🎴 教学牌桌
          </button>
        </div>

        {/* 右侧：当前玩家 + 历史保存（由 HistoryDrawer 自身渲染） */}
        <div className="flex items-center gap-2 mr-32">
          <span className="text-gray-500 text-xs">
            当前出牌：
            <span className="text-white font-semibold">
              {table.currentPlayer === 'SOUTH' ? '南家'
                : table.currentPlayer === 'NORTH' ? '北家'
                  : table.currentPlayer === 'EAST' ? '东家' : '西家'}
            </span>
          </span>
        </div>
      </header>

      {/* ── 主内容区 ───────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'setup' ? (
          <SetupMatrixPanel />
        ) : (
          <MainTable />
        )}
      </main>

      {/* ── 历史抽屉（全局浮层，两个 Tab 下均可用） ────────── */}
      <HistoryDrawer />
    </div>
  );
}
