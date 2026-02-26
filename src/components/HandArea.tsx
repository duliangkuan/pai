'use client';

import React from 'react';
import { Card, PlayerPosition, Rank } from '@/types/guandan';
import CardTile from './CardTile';
import { SUIT_SYMBOL } from './CardTile';

interface HandAreaProps {
  position: PlayerPosition;
  cards: Card[];
  isRevealed: boolean;
  levelRank: Rank;
  /** 该玩家是否为当前出牌方（决定高亮、是否可选牌） */
  isCurrent: boolean;
  /** 已选中的牌 id 集合（仅当前出牌方生效） */
  selectedCardIds?: Set<string>;
  /** 点击牌面的回调（仅当 isCurrent=true 时触发） */
  onToggleCard?: (card: Card) => void;
  /** 切换明暗牌 */
  onToggleReveal: () => void;
  /** 点击玩家名称区域 → 将该玩家设为当前出牌方（上帝之手） */
  onSetAsCurrent?: () => void;
  /** 违规标记牌 ids（红框） */
  violatingCardIds?: Set<string>;
}

const POSITION_DISPLAY: Record<PlayerPosition, string> = {
  SOUTH: '南家',
  NORTH: '北家',
  EAST: '东家',
  WEST: '西家',
};

export default function HandArea({
  position,
  cards,
  isRevealed,
  levelRank,
  isCurrent,
  selectedCardIds = new Set(),
  onToggleCard,
  onToggleReveal,
  onSetAsCurrent,
  violatingCardIds = new Set(),
}: HandAreaProps) {
  const isSouth = position === 'SOUTH';

  return (
    <div
      className={[
        'flex flex-col items-center gap-1 rounded-2xl p-1.5 transition-all duration-200',
        // 焦点高亮：当前出牌方添加醒目金色光圈
        isCurrent
          ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-[#0D5B46]'
          : 'ring-0',
      ].join(' ')}
    >
      {/* ── 玩家标签行 ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* 点击玩家名 → 上帝之手切换出牌方 */}
        <button
          onClick={onSetAsCurrent}
          title={`点击将 ${POSITION_DISPLAY[position]} 设为当前出牌方`}
          className={[
            'text-xs font-bold px-2 py-0.5 rounded-full transition-colors',
            isCurrent
              ? 'bg-yellow-400 text-gray-900 cursor-default'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-500 hover:text-white cursor-pointer',
          ].join(' ')}
        >
          {POSITION_DISPLAY[position]}
          {isCurrent ? '' : ''}
        </button>

        {/* 🟢 当前出牌徽章 */}
        {isCurrent && (
          <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-semibold leading-tight animate-pulse">
            🟢 出牌
          </span>
        )}

        <span className="text-gray-400 text-xs">{cards.length}张</span>

        {/* 眼睛按钮 */}
        <button
          onClick={onToggleReveal}
          title={isRevealed ? '点击隐藏手牌' : '点击显示手牌'}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          {isRevealed ? '👁️' : '🙈'}
        </button>
      </div>

      {/* ── 手牌展示区 ─────────────────────────────────────── */}
      {isRevealed ? (
        <div className="flex flex-wrap justify-center gap-1 px-2">
          {cards.map((card) => {
            const selected = isCurrent && selectedCardIds.has(card.id);
            const ruleViolation = violatingCardIds.has(card.id);
            const actingLabel = card.actingAs
              ? `${SUIT_SYMBOL[card.actingAs.suit]}${card.actingAs.rank}`
              : undefined;
            return (
              <CardTile
                key={card.id}
                card={card}
                levelRank={levelRank}
                selected={selected}
                ruleViolation={ruleViolation}
                actingAsLabel={actingLabel}
                size="sm"
                // 非当前出牌方的牌不可点击选中
                onClick={isCurrent ? () => onToggleCard?.(card) : undefined}
                disabled={!isCurrent && onToggleCard !== undefined}
              />
            );
          })}
          {cards.length === 0 && (
            <span className="text-gray-600 text-xs italic py-2">（空手）</span>
          )}
        </div>
      ) : (
        /* 暗牌：显示牌背 */
        <div className="flex flex-wrap justify-center gap-1 px-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="w-8 h-11 rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600 shadow"
            />
          ))}
          {cards.length === 0 && (
            <span className="text-gray-600 text-xs italic py-2">（空手）</span>
          )}
        </div>
      )}
    </div>
  );
}
