'use client';

import React from 'react';
import { Card, Rank, Suit } from '@/types/guandan';

// ── 花色/点数映射（供 SetupMatrixPanel 等外部使用）────────────────
export const SUIT_SYMBOL: Record<Suit, string> = {
  Spades: '♠',
  Hearts: '♥',
  Clubs: '♣',
  Diamonds: '♦',
  Joker: '', // 大小王不显示符号，只用汉字
};

export const SUIT_COLOR: Record<Suit, string> = {
  Spades: 'text-black',
  Hearts: 'text-red-700',
  Clubs: 'text-black',
  Diamonds: 'text-red-700',
  Joker: 'text-gray-900',
};

export type CardLayoutMode = 'full' | 'compact-horizontal' | 'compact-vertical' | 'corner-only';

/** 经典大小王牌面：白底、左侧竖向 JOKER 字母、中央小丑图（纯代码实现） */
function JokerCardFace({
  isBig,
  size,
  isCompact,
}: {
  isBig: boolean;
  size: 'sm' | 'md' | 'lg';
  isCompact: boolean;
}) {
  const textColor = isBig ? 'text-red-800' : 'text-gray-900';
  const charSize = size === 'lg' ? 'text-sm' : size === 'md' ? 'text-xs' : 'text-[8px]';
  const svgSize = size === 'lg' ? 40 : size === 'md' ? 32 : 22;

  return (
    <div className="absolute inset-0 flex">
      {/* 左侧竖向文字：JOKER 竖排（大写英文字母） */}
      <div className="flex flex-col items-center justify-center pl-1 gap-0 shrink-0">
        {'JOKER'.split('').map((char, i) => (
          <span key={i} className={`${charSize} font-bold ${textColor} leading-none tracking-tight`}>
            {char}
          </span>
        ))}
      </div>
      {/* 中央小丑图（SVG） */}
      {!isCompact && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pl-6">
          <svg viewBox="0 0 80 100" width={svgSize} height={svgSize * 1.25}>
            {/* 小丑帽（大王红/小王黑） */}
            <path
              d="M40 8 L18 50 L24 54 L40 40 L56 54 L62 50 Z"
              fill={isBig ? '#b91c1c' : '#374151'}
              stroke="#111827"
              strokeWidth="1.2"
            />
            {/* 帽尖铃铛 */}
            <circle cx="24" cy="54" r="5" fill="#fbbf24" stroke="#92400e" strokeWidth="0.8" />
            <circle cx="40" cy="40" r="5" fill="#fbbf24" stroke="#92400e" strokeWidth="0.8" />
            <circle cx="56" cy="54" r="5" fill="#fbbf24" stroke="#92400e" strokeWidth="0.8" />
            {/* 脸部 */}
            <ellipse cx="40" cy="78" rx="24" ry="28" fill="#fef3c7" stroke="#1f2937" strokeWidth="1.2" />
            {/* 眼睛 */}
            <ellipse cx="32" cy="73" rx="5" ry="6" fill="#1f2937" />
            <ellipse cx="48" cy="73" rx="5" ry="6" fill="#1f2937" />
            {/* 微笑 */}
            <path d="M28 88 Q40 98 52 88" fill="none" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" />
            {/* 红鼻子 */}
            <circle cx="40" cy="82" r="4" fill="#ef4444" />
          </svg>
        </div>
      )}
    </div>
  );
}

interface CardTileProps {
  card: Card;
  levelRank: Rank;
  /** 是否明牌（false 时显示牌背） */
  isRevealed?: boolean;
  /** 是否被选中（框选高亮） */
  selected?: boolean;
  /** 是否标记违规（红框） */
  ruleViolation?: boolean;
  onClick?: () => void;
  /** 尺寸：sm=出牌区小牌, md=对手中等, lg=南家大牌 */
  size?: 'sm' | 'md' | 'lg';
  /** 布局模式：full=全量展示, compact=仅左上角（节省 DOM） */
  layoutMode?: CardLayoutMode;
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
  layoutMode = 'full',
  disabled = false,
}: CardTileProps) {
  const isCornerOnly = layoutMode === 'corner-only';
  // corner-only：仅左上角小方块，数字花色占满
  const sizeClass = isCornerOnly
    ? 'w-14 h-11 min-w-14 min-h-11'
    : {
        sm: 'w-8 h-11',
        md: 'w-[48px] h-[68px]',
        lg: 'w-[64px] h-[90px]',
      }[size];

  const actingLabel = card.actingAs
    ? `${SUIT_SYMBOL[card.actingAs.suit]}${card.actingAs.rank === 'Small' ? '小' : card.actingAs.rank === 'Big' ? '大' : card.actingAs.rank}`
    : undefined;

  const displayRank =
    card.rank === 'Small' ? '小王' : card.rank === 'Big' ? '大王' : card.rank;

  const isJoker = card.suit === 'Joker';
  const isBigJoker = isJoker && card.rank === 'Big';
  const isSmallJoker = isJoker && card.rank === 'Small';

  const isCompact = layoutMode === 'compact-horizontal' || layoutMode === 'compact-vertical' || isCornerOnly;
  const suitColor = SUIT_COLOR[card.suit];

  // 明牌：极简白底大字报风格；暗牌：牌背图片；大小王：经典 Joker 牌面图
  const cardStyle = !isRevealed
    ? 'border-gray-400 bg-gray-100'
    : card.isWildcard
      ? 'border-yellow-500 bg-yellow-50 text-yellow-800 shadow-[0_0_6px_rgba(234,179,8,0.3)]'
      : isJoker
        ? 'border-gray-400 bg-white'
        : 'bg-white border-gray-300 shadow-sm';

  // 角标区字号：corner-only 小方块内数字花色占满；lg 大牌用更大字
  const rankSizeClass = isCornerOnly
    ? 'text-lg'
    : size === 'lg'
      ? 'text-xl'
      : size === 'md'
        ? 'text-base'
        : 'text-[10px]';
  const suitSizeClass = isCornerOnly
    ? 'text-base'
    : size === 'lg'
      ? 'text-sm'
      : size === 'md'
        ? 'text-xs'
        : 'text-[8px]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative flex flex-col select-none transition-all duration-150 overflow-hidden rounded-md border',
        sizeClass,
        cardStyle,
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-red-400',
        selected ? 'ring-2 ring-red-500' : '',
        ruleViolation ? 'ring-2 ring-red-500' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isRevealed ? (
        <>
          {isJoker ? (
            isCornerOnly ? (
              /* corner-only：大小王 JOKER 占满小方块 */
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xs font-bold leading-tight ${isBigJoker ? 'text-red-700' : 'text-gray-900'}`}>
                  JOKER
                </span>
              </div>
            ) : (
            /* 大小王：经典 Joker 牌面（代码实现：白底、竖向文字、小丑图） */
            <JokerCardFace
              isBig={isBigJoker}
              size={size}
              isCompact={isCompact}
            />
            )
          ) : (
            <>
          {/* 角标区：数字 + 小花色；corner-only 时居中占满小方块 */}
          <div className={[
            'flex flex-row items-center justify-center gap-0.5 leading-tight',
            isCornerOnly ? 'absolute inset-0' : 'absolute left-0.5 top-0.5 z-10',
          ].filter(Boolean).join(' ')}>
            <span className={`${rankSizeClass} font-bold ${suitColor}`}>
              {displayRank}
            </span>
            {SUIT_SYMBOL[card.suit] && (
              <span className={`${suitSizeClass} font-bold ${suitColor}`}>
                {SUIT_SYMBOL[card.suit]}
              </span>
            )}
          </div>
          {/* full 模式：大花色在中心 */}
          {!isCompact && (
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${suitColor} translate-x-1 translate-y-1`}>
              <span className={size === 'lg' ? 'text-3xl' : 'text-2xl'}>{SUIT_SYMBOL[card.suit]}</span>
            </div>
          )}
            </>
          )}
        </>
      ) : (
        <img
          src="/cards/card-back.png"
          alt="牌背"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* 逢人配打出时：代 X 角标 */}
      {actingLabel && (
        <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 text-[8px] font-bold px-0.5 rounded leading-tight shadow z-20">
          代{actingLabel}
        </span>
      )}
      {/* 逢人配在手牌：配 角标（右上角，不遮挡左上角数字） */}
      {card.isWildcard && !actingLabel && isRevealed && (
        <span className="absolute -top-1 -right-1 bg-amber-400 text-gray-900 text-sm font-bold px-1.5 py-0.5 rounded-md ring-2 ring-amber-600 shadow-lg z-20">
          配
        </span>
      )}
    </button>
  );
}
