'use client';

import React from 'react';
import { Card, Rank, Suit } from '@/types/guandan';

// ── 花色/点数映射（供 SetupMatrixPanel 等外部使用）────────────────
export const SUIT_SYMBOL: Record<Suit, string> = {
  Spades: '♠',
  Hearts: '♥',
  Clubs: '♣',
  Diamonds: '♦',
  Joker: '🃏',
};

export const SUIT_COLOR: Record<Suit, string> = {
  Spades: 'text-gray-900',
  Hearts: 'text-red-600',
  Clubs: 'text-gray-900',
  Diamonds: 'text-red-600',
  Joker: 'text-purple-700',
};

// ── 图片路径映射 ────────────────────────────────────────────────
const SUIT_TO_FILENAME: Record<Exclude<Suit, 'Joker'>, string> = {
  Spades: 'spade',
  Hearts: 'heart',
  Clubs: 'club',
  Diamonds: 'diamond',
};

const RANK_TO_FILENAME: Record<Exclude<Rank, 'Small' | 'Big'>, string> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

export function getCardImagePath(card: Card, isRevealed: boolean): string {
  if (!isRevealed) return '/cards/card-back.png';
  if (card.suit === 'Joker') {
    return card.rank === 'Big' ? '/cards/joker-big.png' : '/cards/joker-small.png';
  }
  const suit = SUIT_TO_FILENAME[card.suit];
  const rank = RANK_TO_FILENAME[card.rank as Exclude<Rank, 'Small' | 'Big'>];
  return `/cards/${suit}-${rank}.png`;
}

interface CardTileProps {
  card: Card;
  levelRank: Rank;
  /** 是否明牌（false 时显示牌背） */
  isRevealed?: boolean;
  /** 是否被选中（微微上浮） */
  selected?: boolean;
  /** 是否标记违规（红框） */
  ruleViolation?: boolean;
  onClick?: () => void;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export default function CardTile({
  card,
  levelRank,
  isRevealed = true,
  selected = false,
  ruleViolation = false,
  onClick,
  size = 'md',
  disabled = false,
}: CardTileProps) {
  const sizeClass = {
    sm: 'w-8 h-11',
    md: 'w-12 h-16',
    lg: 'w-16 h-[88px]',
  }[size];

  const actingLabel = card.actingAs
    ? `${SUIT_SYMBOL[card.actingAs.suit]}${card.actingAs.rank === 'Small' ? '小' : card.actingAs.rank === 'Big' ? '大' : card.actingAs.rank}`
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative flex items-center justify-center select-none transition-all duration-150 overflow-hidden rounded-lg shadow-md',
        sizeClass,
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg hover:-translate-y-2 hover:z-50',
        selected ? '-translate-y-3 shadow-xl ring-2 ring-yellow-400 z-50' : '',
        ruleViolation ? 'ring-2 ring-red-500' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <img
        src={getCardImagePath(card, isRevealed)}
        alt="card"
        className="w-full h-full object-contain pointer-events-none"
      />
      {/* 逢人配打出时：代 X 角标 */}
      {actingLabel && (
        <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 text-[8px] font-bold px-0.5 rounded leading-tight shadow">
          代{actingLabel}
        </span>
      )}
      {/* 逢人配在手牌：配 角标 */}
      {card.isWildcard && !actingLabel && isRevealed && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-yellow-400 text-gray-900 text-[8px] font-bold px-0.5 rounded leading-tight shadow">
          配
        </span>
      )}
    </button>
  );
}
