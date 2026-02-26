'use client';

import React, { useState } from 'react';
import { PlayerPosition, Rank, Suit } from '@/types/guandan';
import { useGuandanStore } from '@/store/useGuandanStore';
import { SUIT_SYMBOL, SUIT_COLOR } from './CardTile';

// ── 常量 ──────────────────────────────────────────────────────
const SUITS: Suit[] = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
const JOKER_RANKS: Rank[] = ['Small', 'Big'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const ALL_LEVEL_RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const POSITION_LABEL: Record<PlayerPosition, string> = {
  SOUTH: '南 🧑',
  NORTH: '北 👤',
  EAST: '东 👤',
  WEST: '西 👤',
};

const PLAYER_ORDER: PlayerPosition[] = ['EAST', 'NORTH', 'WEST', 'SOUTH'];

export default function SetupMatrixPanel() {
  const {
    players,
    table,
    cardPool,
    setLevel,
    assignCardToPlayer,
    returnCardFromPlayer,
    clearPlayerHand,
    clearAllHands,
    randomDeal,
  } = useGuandanStore();

  const [activePlayer, setActivePlayer] = useState<PlayerPosition>('SOUTH');

  // ── 点击矩阵中的牌 ─────────────────────────────────────────
  function handleMatrixClick(suit: Suit, rank: Rank) {
    const key = `${suit}-${rank}`;
    if ((cardPool[key] ?? 0) <= 0) return;
    assignCardToPlayer(suit, rank, activePlayer);
  }

  // ── 渲染单个矩阵格子 ────────────────────────────────────────
  function MatrixCell({ suit, rank }: { suit: Suit; rank: Rank }) {
    const key = `${suit}-${rank}`;
    const remaining = cardPool[key] ?? 0;
    const isLevelCard =
      rank !== 'Small' && rank !== 'Big' && rank === table.currentLevelRank;
    const isWild = isLevelCard && suit === 'Hearts';
    const isDisabled = remaining === 0;

    return (
      <button
        key={key}
        disabled={isDisabled}
        onClick={() => handleMatrixClick(suit, rank)}
        className={[
          'relative w-12 h-14 rounded-lg border-2 flex flex-col items-center justify-center text-sm font-bold transition-all duration-100 select-none',
          isDisabled
            ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
            : 'bg-white hover:bg-yellow-50 hover:shadow-md active:scale-95 cursor-pointer',
          isWild
            ? 'border-yellow-500 shadow-[0_0_10px_yellow]'
            : isLevelCard
              ? 'border-orange-400'
              : 'border-gray-200',
          SUIT_COLOR[suit],
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="text-base leading-none">{SUIT_SYMBOL[suit]}</span>
        <span className="text-xs leading-none mt-0.5">
          {rank === 'Small' ? '小王' : rank === 'Big' ? '大王' : rank}
        </span>
        {/* 剩余数量角标 */}
        <span
          className={[
            'absolute -top-1.5 -right-1.5 min-w-[16px] h-4 text-[10px] font-extrabold rounded-full flex items-center justify-center px-0.5',
            remaining === 2
              ? 'bg-green-500 text-white'
              : remaining === 1
                ? 'bg-yellow-400 text-gray-900'
                : 'bg-gray-300 text-gray-400',
          ].join(' ')}
        >
          {remaining}
        </span>
      </button>
    );
  }

  // ── 渲染大小王格子 ──────────────────────────────────────────
  function JokerCell({ rank }: { rank: Rank }) {
    const key = `Joker-${rank}`;
    const remaining = cardPool[key] ?? 0;
    const isDisabled = remaining === 0;
    const label = rank === 'Small' ? '小王' : '大王';
    return (
      <button
        disabled={isDisabled}
        onClick={() => handleMatrixClick('Joker', rank)}
        className={[
          'relative w-12 h-14 rounded-lg border-2 flex flex-col items-center justify-center text-xs font-bold transition-all duration-100 select-none',
          isDisabled
            ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
            : 'bg-purple-50 hover:bg-purple-100 hover:shadow-md active:scale-95 cursor-pointer border-purple-400 text-purple-700',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="text-lg leading-none">🃏</span>
        <span className="text-[10px] leading-none mt-0.5">{label}</span>
        <span
          className={[
            'absolute -top-1.5 -right-1.5 min-w-[16px] h-4 text-[10px] font-extrabold rounded-full flex items-center justify-center px-0.5',
            remaining === 2
              ? 'bg-green-500 text-white'
              : remaining === 1
                ? 'bg-yellow-400 text-gray-900'
                : 'bg-gray-300 text-gray-400',
          ].join(' ')}
        >
          {remaining}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-900 min-h-screen text-white">
      {/* ── 顶部控制栏 ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-800 rounded-xl p-3">
        {/* 设置级牌 */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">打几：</span>
          <select
            value={table.currentLevelRank}
            onChange={(e) => setLevel(e.target.value as Rank)}
            className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            {ALL_LEVEL_RANKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span className="text-yellow-400 text-xs">
            (逢人配: ♥{table.currentLevelRank})
          </span>
        </div>

        <div className="h-6 w-px bg-gray-600" />

        {/* 操作按钮 */}
        <button
          onClick={() => clearPlayerHand(activePlayer)}
          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg transition-colors"
        >
          清空 {POSITION_LABEL[activePlayer]}
        </button>
        <button
          onClick={clearAllHands}
          className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
        >
          一键清空全盘
        </button>
        {(() => {
          const totalInPool = Object.values(cardPool).reduce((a, b) => a + b, 0);
          const canRandomDeal = totalInPool > 0;
          return (
            <button
              onClick={randomDeal}
              disabled={!canRandomDeal}
              className={[
                'px-3 py-1.5 text-white text-sm rounded-lg transition-colors',
                canRandomDeal
                  ? 'bg-blue-600 hover:bg-blue-500 cursor-pointer'
                  : 'bg-gray-500 cursor-not-allowed opacity-60',
              ].join(' ')}
            >
              随机发牌 🎲
            </button>
          );
        })()}
      </div>

      {/* ── 玩家槽位区 ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PLAYER_ORDER.map((pos) => {
          const player = players[pos];
          const isActive = pos === activePlayer;
          return (
            <div
              key={pos}
              onClick={() => setActivePlayer(pos)}
              className={[
                'rounded-xl p-3 cursor-pointer transition-all duration-200 bg-gray-800 border-2',
                isActive
                  ? 'ring-4 ring-yellow-400 border-yellow-400 bg-gray-700'
                  : 'border-gray-700 hover:border-gray-500',
              ].join(' ')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{POSITION_LABEL[pos]}</span>
                <span className="text-xs text-gray-400">
                  {player.handCards.length} 张
                </span>
              </div>

              {/* 手牌缩略图 */}
              <div className="flex flex-wrap gap-1 min-h-[36px]">
                {player.handCards.map((card) => {
                  const isWild = card.isWildcard;
                  const displayRank =
                    card.rank === 'Small' ? '小' : card.rank === 'Big' ? '大' : card.rank;
                  return (
                    <button
                      key={card.id}
                      title={`退回 ${SUIT_SYMBOL[card.suit]}${displayRank}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        returnCardFromPlayer(card.id, pos);
                      }}
                      className={[
                        'w-7 h-9 rounded text-[10px] font-bold flex flex-col items-center justify-center border transition-all hover:scale-110 hover:shadow-md',
                        isWild
                          ? 'border-yellow-500 bg-yellow-900 text-yellow-300 shadow-[0_0_6px_rgba(234,179,8,0.5)]'
                          : card.suit === 'Joker'
                            ? 'border-purple-500 bg-purple-900 text-purple-300'
                            : card.suit === 'Hearts' || card.suit === 'Diamonds'
                              ? 'border-red-400 bg-red-950 text-red-400'
                              : 'border-gray-400 bg-gray-900 text-gray-200',
                      ].join(' ')}
                    >
                      <span className="leading-none text-[8px]">{SUIT_SYMBOL[card.suit]}</span>
                      <span className="leading-none">{displayRank}</span>
                    </button>
                  );
                })}
                {player.handCards.length === 0 && (
                  <span className="text-gray-600 text-xs italic">点击牌面添加</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 卡牌矩阵区 ─────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-4 overflow-x-auto">
        <h3 className="text-gray-400 text-sm mb-3 font-semibold">
          点击牌面 → 添加到「{POSITION_LABEL[activePlayer]}」的手牌
        </h3>

        {/* 点数表头 */}
        <div className="flex gap-2 mb-2 pl-16">
          {RANKS.map((r) => (
            <div
              key={r}
              className={[
                'w-12 text-center text-xs font-bold',
                r === table.currentLevelRank ? 'text-yellow-400' : 'text-gray-500',
              ].join(' ')}
            >
              {r}
            </div>
          ))}
        </div>

        {/* 普通花色行 */}
        {SUITS.map((suit) => (
          <div key={suit} className="flex items-center gap-2 mb-2">
            {/* 花色标签 */}
            <div
              className={`w-14 flex items-center justify-center text-xl font-bold ${SUIT_COLOR[suit]}`}
            >
              {SUIT_SYMBOL[suit]}
            </div>
            {/* 牌格 */}
            {RANKS.map((rank) => (
              <MatrixCell key={`${suit}-${rank}`} suit={suit} rank={rank} />
            ))}
          </div>
        ))}

        {/* 王牌行 */}
        <div className="flex items-center gap-2 mt-2">
          <div className="w-14 flex items-center justify-center text-xl font-bold text-purple-400">
            🃏
          </div>
          {JOKER_RANKS.map((rank) => (
            <JokerCell key={rank} rank={rank} />
          ))}
        </div>
      </div>
    </div>
  );
}
