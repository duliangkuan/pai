'use client';

import React from 'react';
import { PlayAction, PlayTypeName, Rank } from '@/types/guandan';
import CardTile from './CardTile';

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

interface PlayedCardZoneProps {
  action: PlayAction | undefined;
  levelRank: Rank;
}

export default function PlayedCardZone({ action, levelRank }: PlayedCardZoneProps) {
  if (!action) return null;

  return (
    <div
      className={[
        'flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg min-h-[48px]',
        action.isRuleViolation ? 'ring-2 ring-red-500 bg-red-900/30' : 'bg-green-900/20',
      ].join(' ')}
    >
      {action.playedCards.length > 0 ? (
        <div className="flex flex-row justify-center items-center origin-center">
          {action.playedCards.map((card, idx) => (
            <div key={card.id} className={`relative ${idx > 0 ? '-ml-8' : ''}`} style={{ zIndex: idx }}>
              <CardTile
                card={card}
                levelRank={levelRank}
                size="lg"
                ruleViolation={action.isRuleViolation}
              />
            </div>
          ))}
        </div>
      ) : (
        <span className="text-gray-400 text-xs italic">不出</span>
      )}
      <span
        className={[
          'text-base font-bold',
          action.isRuleViolation ? 'text-red-400' : 'text-green-300',
        ].join(' ')}
      >
        {PLAY_TYPE_LABEL[action.playType]}
        {action.isRuleViolation ? ' ⚠️' : ''}
      </span>
    </div>
  );
}
