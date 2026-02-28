'use client';

import React, { useMemo } from 'react';
import { Card, OrganizedGroup, PlayerPosition, Rank } from '@/types/guandan';
import {
  groupCardsByRankForNS,
  groupCardsByRankForWE,
  sortOrganizedGroups,
} from '@/utils/guandanRules';
import CardTile from './CardTile';

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
  /** 南北家：同数字一列，列从右向左从小到大；西东家：同数字一行，行从下到上从小到大 */
  layoutMode?: 'normal' | 'ns-column' | 'we-row';
  /** 理牌分组（仅 ns-column / we-row 时生效） */
  organizedGroups?: OrganizedGroup[];
}

const POSITION_DISPLAY: Record<PlayerPosition, string> = {
  SOUTH: '南家',
  NORTH: '北家',
  EAST: '东家',
  WEST: '西家',
};

/** 从 id 列表取牌（保持 group 内顺序） */
function getCardsByIds(cards: Card[], ids: string[]): Card[] {
  const map = new Map(cards.map((c) => [c.id, c]));
  return ids.map((id) => map.get(id)).filter((c): c is Card => c != null);
}

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
  layoutMode = 'normal',
  organizedGroups = [],
}: HandAreaProps) {
  const isNSColumn = layoutMode === 'ns-column';
  const isWERow = layoutMode === 'we-row';
  const hasOrganized = organizedGroups.length > 0;

  // 理牌三区：炸弹区 | 非理牌区 | 非炸弹区
  const { bombGroups, unorganizedCards, nonBombGroups } = useMemo(() => {
    const inAnyGroup = new Set<string>();
    for (const g of organizedGroups) {
      for (const id of g.cardIds) inAnyGroup.add(id);
    }
    const unorg = cards.filter((c) => !inAnyGroup.has(c.id));
    const bombGroups = sortOrganizedGroups(
      organizedGroups.filter((g) => g.isBomb)
    );
    const nonBombGroups = sortOrganizedGroups(
      organizedGroups.filter((g) => !g.isBomb)
    );
    return { bombGroups, unorganizedCards: unorg, nonBombGroups };
  }, [cards, organizedGroups]);

  // NS：一列一列；WE：一行一行
  const renderColumn = (columnCards: Card[], key: string) => (
    <div key={key} className="flex flex-col-reverse gap-0.5 items-center">
      {columnCards.map((card) => {
        const selected = isCurrent && selectedCardIds.has(card.id);
        const ruleViolation = violatingCardIds.has(card.id);
        return (
          <CardTile
            key={card.id}
            card={card}
            levelRank={levelRank}
            isRevealed={isRevealed}
            selected={selected}
            ruleViolation={ruleViolation}
            size="sm"
            onClick={isCurrent ? () => onToggleCard?.(card) : undefined}
            disabled={!isCurrent && onToggleCard !== undefined}
          />
        );
      })}
    </div>
  );

  const renderRow = (rowCards: Card[], key: string) => (
    <div key={key} className="flex flex-row gap-0.5 justify-center flex-wrap">
      {rowCards.map((card) => {
        const selected = isCurrent && selectedCardIds.has(card.id);
        const ruleViolation = violatingCardIds.has(card.id);
        return (
          <CardTile
            key={card.id}
            card={card}
            levelRank={levelRank}
            isRevealed={isRevealed}
            selected={selected}
            ruleViolation={ruleViolation}
            size="sm"
            onClick={isCurrent ? () => onToggleCard?.(card) : undefined}
            disabled={!isCurrent && onToggleCard !== undefined}
          />
        );
      })}
    </div>
  );

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
        isNSColumn ? (
          /* 南北家：炸弹区(左) | 非理牌区(中) | 非炸弹区(右)，每区从左到右=大到小 */
          <div className="flex flex-row gap-0.5 justify-center items-end flex-wrap max-w-full">
            {hasOrganized ? (
              <>
                {bombGroups.map((g, i) =>
                  renderColumn(getCardsByIds(cards, g.cardIds), `bomb-${i}`)
                )}
                {groupCardsByRankForNS(unorganizedCards, levelRank).map((col, i) =>
                  renderColumn(col, `unorg-${i}`)
                )}
                {nonBombGroups.map((g, i) =>
                  renderColumn(getCardsByIds(cards, g.cardIds), `nobomb-${i}`)
                )}
              </>
            ) : (
              groupCardsByRankForNS(cards, levelRank).map((column, colIdx) =>
                renderColumn(column, `col-${colIdx}`)
              )
            )}
            {cards.length === 0 && (
              <span className="text-gray-600 text-xs italic py-2">（空手）</span>
            )}
          </div>
        ) : isWERow ? (
          /* 东家/西家：炸弹区(上) | 非理牌区(中) | 非炸弹区(下)，每区从上到下=大到小 */
          <div
            className={
              hasOrganized
                ? 'flex flex-col gap-0.5 items-center'
                : 'flex flex-col-reverse gap-0.5 items-center'
            }
          >
            {hasOrganized ? (
              <>
                {bombGroups.map((g, i) =>
                  renderRow(getCardsByIds(cards, g.cardIds), `bomb-${i}`)
                )}
                {[...groupCardsByRankForWE(unorganizedCards, levelRank)]
                  .reverse()
                  .map((row, i) => renderRow(row, `unorg-${i}`))}
                {nonBombGroups.map((g, i) =>
                  renderRow(getCardsByIds(cards, g.cardIds), `nobomb-${i}`)
                )}
              </>
            ) : (
              groupCardsByRankForWE(cards, levelRank).map((row, rowIdx) =>
                renderRow(row, `row-${rowIdx}`)
              )
            )}
            {cards.length === 0 && (
              <span className="text-gray-600 text-xs italic py-2">（空手）</span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-1 px-2">
            {cards.map((card) => {
              const selected = isCurrent && selectedCardIds.has(card.id);
              const ruleViolation = violatingCardIds.has(card.id);
              return (
                <CardTile
                  key={card.id}
                  card={card}
                  levelRank={levelRank}
                  isRevealed={isRevealed}
                  selected={selected}
                  ruleViolation={ruleViolation}
                  size="sm"
                  onClick={isCurrent ? () => onToggleCard?.(card) : undefined}
                  disabled={!isCurrent && onToggleCard !== undefined}
                />
              );
            })}
            {cards.length === 0 && (
              <span className="text-gray-600 text-xs italic py-2">（空手）</span>
            )}
          </div>
        )
      ) : (
        /* 暗牌：显示牌背图片 */
        isNSColumn ? (
          <div className="flex flex-row gap-0.5 justify-center items-end flex-wrap max-w-full">
            {hasOrganized ? (
              <>
                {bombGroups.map((g, i) => (
                  <div key={`bomb-${i}`} className="flex flex-col-reverse gap-0.5 items-center">
                    {getCardsByIds(cards, g.cardIds).map((card) => (
                      <CardTile key={card.id} card={card} levelRank={levelRank} isRevealed={false} size="sm" />
                    ))}
                  </div>
                ))}
                {groupCardsByRankForNS(unorganizedCards, levelRank).map((col, i) => (
                  <div key={`unorg-${i}`} className="flex flex-col-reverse gap-0.5 items-center">
                    {col.map((card) => (
                      <CardTile key={card.id} card={card} levelRank={levelRank} isRevealed={false} size="sm" />
                    ))}
                  </div>
                ))}
                {nonBombGroups.map((g, i) => (
                  <div key={`nobomb-${i}`} className="flex flex-col-reverse gap-0.5 items-center">
                    {getCardsByIds(cards, g.cardIds).map((card) => (
                      <CardTile key={card.id} card={card} levelRank={levelRank} isRevealed={false} size="sm" />
                    ))}
                  </div>
                ))}
              </>
            ) : (
              groupCardsByRankForNS(cards, levelRank).map((column, colIdx) => (
                <div key={colIdx} className="flex flex-col-reverse gap-0.5 items-center">
                  {column.map((card) => (
                    <CardTile key={card.id} card={card} levelRank={levelRank} isRevealed={false} size="sm" />
                  ))}
                </div>
              ))
            )}
            {cards.length === 0 && (
              <span className="text-gray-600 text-xs italic py-2">（空手）</span>
            )}
          </div>
        ) : isWERow ? (
          <div
            className={
              hasOrganized
                ? 'flex flex-col gap-0.5 items-center'
                : 'flex flex-col-reverse gap-0.5 items-center'
            }
          >
            {hasOrganized ? (
              <>
                {bombGroups.map((g, i) => (
                  <div key={`bomb-${i}`} className="flex flex-row gap-0.5 justify-center flex-wrap">
                    {getCardsByIds(cards, g.cardIds).map((card) => (
                      <CardTile key={card.id} card={card} levelRank={levelRank} isRevealed={false} size="sm" />
                    ))}
                  </div>
                ))}
                {[...groupCardsByRankForWE(unorganizedCards, levelRank)]
                  .reverse()
                  .map((row, i) => (
                    <div key={`unorg-${i}`} className="flex flex-row gap-0.5 justify-center flex-wrap">
                      {row.map((card) => (
                        <CardTile key={card.id} card={card} levelRank={levelRank} isRevealed={false} size="sm" />
                      ))}
                    </div>
                  ))}
                {nonBombGroups.map((g, i) => (
                  <div key={`nobomb-${i}`} className="flex flex-row gap-0.5 justify-center flex-wrap">
                    {getCardsByIds(cards, g.cardIds).map((card) => (
                      <CardTile key={card.id} card={card} levelRank={levelRank} isRevealed={false} size="sm" />
                    ))}
                  </div>
                ))}
              </>
            ) : (
              groupCardsByRankForWE(cards, levelRank).map((row, rowIdx) => (
                <div key={rowIdx} className="flex flex-row gap-0.5 justify-center flex-wrap">
                  {row.map((card) => (
                    <CardTile key={card.id} card={card} levelRank={levelRank} isRevealed={false} size="sm" />
                  ))}
                </div>
              ))
            )}
            {cards.length === 0 && (
              <span className="text-gray-600 text-xs italic py-2">（空手）</span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-1 px-2">
            {cards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                levelRank={levelRank}
                isRevealed={false}
                size="sm"
              />
            ))}
            {cards.length === 0 && (
              <span className="text-gray-600 text-xs italic py-2">（空手）</span>
            )}
          </div>
        )
      )}
    </div>
  );
}
