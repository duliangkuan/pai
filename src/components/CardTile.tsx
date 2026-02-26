'use client';

import React from 'react';
import { Card, Rank, Suit } from '@/types/guandan';

// ── 花色相关 ─────────────────────────────────────────────────
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

export const SUIT_BG: Record<Suit, string> = {
  Spades: 'bg-white',
  Hearts: 'bg-white',
  Clubs: 'bg-white',
  Diamonds: 'bg-white',
  Joker: 'bg-purple-50',
};

interface CardTileProps {
  card: Card;
  levelRank: Rank;
  /** 是否被选中（微微上浮） */
  selected?: boolean;
  /** 是否标记违规（红框） */
  ruleViolation?: boolean;
  onClick?: () => void;
  /** 显示逢人配替代角标 */
  actingAsLabel?: string;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export default function CardTile({
  card,
  levelRank,
  selected = false,
  ruleViolation = false,
  onClick,
  actingAsLabel,
  size = 'md',
  disabled = false,
}: CardTileProps) {
  const isWild = card.isWildcard;
  const isJoker = card.suit === 'Joker';

  const sizeClass = {
    sm: 'w-8 h-11 text-xs',
    md: 'w-12 h-16 text-sm',
    lg: 'w-16 h-22 text-base',
  }[size];

  const displayRank = card.rank === 'Small' ? '小' : card.rank === 'Big' ? '大' : card.rank;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative rounded-lg border-2 flex flex-col items-center justify-center select-none transition-all duration-150 shadow-md',
        sizeClass,
        SUIT_BG[card.suit],
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5',
        selected ? '-translate-y-3 shadow-xl ring-2 ring-yellow-400' : '',
        ruleViolation ? 'ring-4 ring-red-500' : '',
        isWild
          ? 'border-yellow-500 shadow-[0_0_8px_2px_rgba(234,179,8,0.6)]'
          : isJoker
            ? 'border-purple-400'
            : 'border-gray-200',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* 花色 + 点数 */}
      <span className={`font-bold leading-tight ${SUIT_COLOR[card.suit]}`}>
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className={`font-extrabold leading-tight ${SUIT_COLOR[card.suit]}`}>
        {displayRank}
      </span>

      {/* 逢人配替代角标 */}
      {actingAsLabel && (
        <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 text-[9px] font-bold px-1 rounded-full shadow">
          代{actingAsLabel}
        </span>
      )}

      {/* 逢人配标识 */}
      {isWild && (
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-yellow-400 text-gray-900 text-[8px] font-bold px-1 rounded-full leading-tight">
          配
        </span>
      )}
    </button>
  );
}
