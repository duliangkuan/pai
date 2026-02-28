'use client';

import React, { useMemo } from 'react';
import { Card, OrganizedGroup, PlayerPosition, Rank } from '@/types/guandan';
import {
  groupCardsByRankForNS,
  groupCardsByRankForWE,
  sortOrganizedGroups,
} from '@/utils/guandanRules';
import CardTile, { CardLayoutMode } from './CardTile';

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

/** 南家：大尺寸，与东西家相同排列（列纵向堆叠） */
const SOUTH_SIZE = 'lg' as const;
const SOUTH_LAYOUT_MODE: CardLayoutMode = 'full';

/** 北家：仅展示左上角小方块（数字+花色），同数字为一列 */
const NORTH_LAYOUT_MODE: CardLayoutMode = 'corner-only';

/** 东西家：与北家相同 corner-only 小方块，同数字为一行，西家左对齐、东家右对齐 */
const EAST_WEST_LAYOUT_MODE: CardLayoutMode = 'corner-only';

/** 北/东/西：列内垂直重叠，只露顶部 ~16px（md 牌高 68px） */
const COLUMN_OVERLAP = '-mt-[52px]'; // 68-52=16px 可见

/** 南家：列内重叠刚好盖住大花色（lg 牌高 90px，大花色中心偏下约 35-65px） */
const SOUTH_COLUMN_OVERLAP = '-mt-[62px]'; // 下一张牌刚好完全盖住上一张的大花色

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

  // ── 南北东西统一：列横向排列，每列内牌纵向堆叠，垂直重叠 ──
  const renderColumn = (
    columnCards: Card[],
    key: string,
    size: 'sm' | 'md' | 'lg',
    layoutMode: CardLayoutMode,
    overlapClass?: string
  ) => {
    const overlap = overlapClass ?? COLUMN_OVERLAP;
    return (
    <div key={key} className="flex flex-col items-center">
      {columnCards.map((card, idx) => {
        const selected = isCurrent && selectedCardIds.has(card.id);
        const ruleViolation = violatingCardIds.has(card.id);
        return (
          <div key={card.id} className={idx > 0 ? overlap : ''}>
            <CardTile
              card={card}
              levelRank={levelRank}
              isRevealed={isRevealed}
              selected={selected}
              ruleViolation={ruleViolation}
              size={size}
              layoutMode={layoutMode}
              onClick={isCurrent ? () => onToggleCard?.(card) : undefined}
              disabled={!isCurrent && onToggleCard !== undefined}
            />
          </div>
        );
      })}
    </div>
  );
  };

  // 南家：大尺寸 + full 模式，底部对齐形成起始线，同数字从上往下排列，重叠刚好盖住大花色
  const renderSouthZone = () => {
    const bombCols = hasOrganized
      ? bombGroups.map((g) => getCardsByIds(cards, g.cardIds))
      : [];
    const unorgCols = hasOrganized
      ? groupCardsByRankForNS(unorganizedCards, levelRank)
      : groupCardsByRankForNS(cards, levelRank);
    const nonBombCols = hasOrganized
      ? nonBombGroups.map((g) => getCardsByIds(cards, g.cardIds))
      : [];
    const allColumns = hasOrganized
      ? [...bombCols, ...unorgCols, ...nonBombCols]
      : unorgCols;

    return (
      <div className="flex flex-row items-end justify-center flex-wrap gap-1 w-fit max-w-full">
        {allColumns.map((col, i) =>
          renderColumn(col, `col-${i}`, SOUTH_SIZE, SOUTH_LAYOUT_MODE, SOUTH_COLUMN_OVERLAP)
        )}
      </div>
    );
  };

  // 北家：同数字为一列，仅展示左上角，方格排列不重叠，上边界为起跑线
  const renderNorthColumn = (columnCards: Card[], key: string) => (
    <div key={key} className="flex flex-col items-center gap-2">
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
            layoutMode={NORTH_LAYOUT_MODE}
            onClick={isCurrent ? () => onToggleCard?.(card) : undefined}
            disabled={!isCurrent && onToggleCard !== undefined}
          />
        );
      })}
    </div>
  );

  const renderNorthZone = () => {
    const bombCols = hasOrganized
      ? bombGroups.map((g) => getCardsByIds(cards, g.cardIds))
      : [];
    const unorgCols = hasOrganized
      ? groupCardsByRankForNS(unorganizedCards, levelRank)
      : groupCardsByRankForNS(cards, levelRank);
    const nonBombCols = hasOrganized
      ? nonBombGroups.map((g) => getCardsByIds(cards, g.cardIds))
      : [];
    const allColumns = hasOrganized
      ? [...bombCols, ...unorgCols, ...nonBombCols]
      : unorgCols;

    return (
      <div className="flex flex-row items-start justify-center flex-wrap gap-2 w-fit max-w-full">
        {allColumns.map((col, i) =>
          renderNorthColumn(col, `col-${i}`)
        )}
      </div>
    );
  };

  // 西家：corner-only 小方块，同数字为一行，以左侧为起始线和对齐线
  const renderWestZone = () => {
    const bombRows = hasOrganized
      ? bombGroups.map((g) => getCardsByIds(cards, g.cardIds))
      : [];
    const unorgRows = hasOrganized
      ? groupCardsByRankForWE(unorganizedCards, levelRank)
      : groupCardsByRankForWE(cards, levelRank);
    const nonBombRows = hasOrganized
      ? nonBombGroups.map((g) => getCardsByIds(cards, g.cardIds))
      : [];
    const allRows = hasOrganized
      ? [...bombRows, ...unorgRows, ...nonBombRows]
      : unorgRows;

    return (
      <div className="flex flex-col items-start gap-2 w-fit min-w-full">
        {allRows.map((rowCards, i) => (
          <div key={`row-${i}`} className="flex flex-row gap-2 shrink-0">
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
                  layoutMode={EAST_WEST_LAYOUT_MODE}
                  onClick={isCurrent ? () => onToggleCard?.(card) : undefined}
                  disabled={!isCurrent && onToggleCard !== undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // 东家：corner-only 小方块，同数字为一行，以右侧为起始线和对齐线
  const renderEastZone = () => {
    const bombRows = hasOrganized
      ? bombGroups.map((g) => getCardsByIds(cards, g.cardIds))
      : [];
    const unorgRows = hasOrganized
      ? groupCardsByRankForWE(unorganizedCards, levelRank)
      : groupCardsByRankForWE(cards, levelRank);
    const nonBombRows = hasOrganized
      ? nonBombGroups.map((g) => getCardsByIds(cards, g.cardIds))
      : [];
    const allRows = hasOrganized
      ? [...bombRows, ...unorgRows, ...nonBombRows]
      : unorgRows;

    return (
      <div className="flex flex-col items-end gap-2 w-fit min-w-full">
        {allRows.map((rowCards, i) => (
          <div key={`row-${i}`} className="flex flex-row gap-2 shrink-0">
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
                  layoutMode={EAST_WEST_LAYOUT_MODE}
                  onClick={isCurrent ? () => onToggleCard?.(card) : undefined}
                  disabled={!isCurrent && onToggleCard !== undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ── 根据 position 选择渲染逻辑 ──
  const renderHandCards = () => {
    if (!isRevealed) {
      // 暗牌：复用对应方位的布局，仅 isRevealed=false
      if (position === 'SOUTH') return renderSouthZone();
      if (position === 'NORTH') return renderNorthZone();
      if (position === 'WEST') return renderWestZone();
      if (position === 'EAST') return renderEastZone();
    }
    if (position === 'SOUTH' && isNSColumn) return renderSouthZone();
    if (position === 'NORTH' && isNSColumn) return renderNorthZone();
    if (position === 'WEST' && isWERow) return renderWestZone();
    if (position === 'EAST' && isWERow) return renderEastZone();

    // normal 模式：简单平铺（兼容旧逻辑）
    return (
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
      </div>
    );
  };

  return (
    <div
      className={[
        'flex flex-col items-center gap-1 rounded-2xl p-1.5 transition-all duration-200 overflow-visible w-fit',
        isCurrent
          ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-[#0D5B46]'
          : 'ring-0',
      ].join(' ')}
    >
      {/* ── 玩家标签行 ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
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
        </button>

        {isCurrent && (
          <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-semibold leading-tight animate-pulse">
            🟢 出牌
          </span>
        )}

        <span className="text-gray-400 text-xs">{cards.length}张</span>

        <button
          onClick={onToggleReveal}
          title={isRevealed ? '点击隐藏手牌' : '点击显示手牌'}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          {isRevealed ? '👁️' : '🙈'}
        </button>
      </div>

      {/* ── 手牌展示区 ─────────────────────────────────────── */}
      {cards.length === 0 ? (
        <span className="text-gray-600 text-xs italic py-2">（空手）</span>
      ) : isRevealed ? (
        renderHandCards()
      ) : (
        (() => {
          if (position === 'SOUTH' && isNSColumn) return renderSouthZone();
          if (position === 'NORTH' && isNSColumn) return renderNorthZone();
          if (position === 'WEST' && isWERow) return renderWestZone();
          if (position === 'EAST' && isWERow) return renderEastZone();
          return (
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
            </div>
          );
        })()
      )}
    </div>
  );
}
