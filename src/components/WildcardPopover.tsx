'use client';

import React from 'react';
import { Card, Rank } from '@/types/guandan';
import { enumerateWildcardOptions, WildcardSuggestion } from '@/utils/guandanRules';

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
      <div className="bg-gray-900 border border-yellow-500/50 rounded-2xl p-5 shadow-2xl w-[min(92vw,480px)]">
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-yellow-400 text-xl">✨</span>
          <h3 className="text-white font-bold text-base">
            逢人配指定 — 请选择替代的牌
          </h3>
        </div>

        {options.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">
            未找到合法替代方案，请重新选牌。
          </p>
        ) : (
          <>
            <p className="text-gray-400 text-xs mb-3">
              共 {options.length} 种合法替代方案：
            </p>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
              {options.map((opt) => (
                <button
                  key={`${opt.suit}-${opt.rank}`}
                  onClick={() => onSelect(opt)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-yellow-600 border border-yellow-500/40 hover:border-yellow-400 text-white text-sm rounded-xl transition-all duration-150 font-semibold hover:scale-105"
                >
                  {opt.displayLabel}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
