'use client';

import React from 'react';
import { Card, Rank } from '@/types/guandan';
import { enumerateWildcardOptions, WildcardSuggestion } from '@/utils/guandanRules';
import { SUIT_COLOR, SUIT_SYMBOL } from './CardTile';

interface WildcardPopoverProps {
  cards: Card[];
  currentLevelRank: Rank;
  onSelect: (suggestion: WildcardSuggestion) => void;
  onCancel: () => void;
}

export default function WildcardPopover({
  cards,
  currentLevelRank,
  onSelect,
  onCancel,
}: WildcardPopoverProps) {
  const options = enumerateWildcardOptions(cards, currentLevelRank);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 shadow-2xl w-[min(95vw,720px)] max-h-[90vh] flex flex-col">
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <span className="text-amber-500 text-2xl">✨</span>
          <h3 className="text-gray-900 font-bold text-lg">
            逢人配指定 — 请选择替代的牌
          </h3>
        </div>

        {options.length === 0 ? (
          <p className="text-gray-600 text-base py-4 text-center">
            未找到合法替代方案，请重新选牌。
          </p>
        ) : (
          <>
            <p className="text-gray-600 text-sm mb-3">
              共 {options.length} 种可选：
            </p>
            <div className="grid grid-cols-9 gap-2 max-h-[60vh] overflow-y-auto pr-2 shrink-0">
              {options.map((opt) => {
                const suitColor = SUIT_COLOR[opt.suit];
                const rankSize = opt.rank === '10' ? 'text-[28px] tracking-[-0.2em]' : 'text-[30px]';
                return (
                  <button
                    key={`${opt.suit}-${opt.rank}`}
                    onClick={() => onSelect(opt)}
                    className="min-w-[56px] min-h-[44px] px-2 py-1.5 flex items-center justify-center gap-0.5 bg-white border-2 border-gray-200 hover:bg-amber-100 hover:border-amber-400 rounded-xl transition-all duration-150 font-bold hover:scale-105 shadow-sm"
                  >
                    <span className={`${suitColor} ${rankSize} leading-tight`}>
                      {opt.rank}
                    </span>
                    <span className={`${suitColor} text-[24px] leading-tight`}>
                      {SUIT_SYMBOL[opt.suit]}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end shrink-0">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-base rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
