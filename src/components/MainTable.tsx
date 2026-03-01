'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, PatternResult, PlayAction, PlayerPosition, PlayTypeName } from '@/types/guandan';
import { useGuandanStore } from '@/store/useGuandanStore';
import { canBeat, identifyPattern } from '@/utils/guandanRules';
import { WildcardSuggestion } from '@/utils/guandanRules';
import HandArea from './HandArea';
import PlayedCardZone from './PlayedCardZone';
import WildcardPopover from './WildcardPopover';

// ── 常量 ─────────────────────────────────────────────────────
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

const POSITION_ZH: Record<PlayerPosition, string> = {
  SOUTH: '南家',
  NORTH: '北家',
  EAST: '东家',
  WEST: '西家',
};

const SHAKE_CLASS = 'animate-shake';

export default function MainTable() {
  const {
    players,
    table,
    organizedGroups,
    undo,
    redo,
    toggleReveal,
    setCurrentPlayer,
    playCards,
    passAction,
    saveSnapshot,
    organizeCards,
    restoreOrganizedGroup,
    restoreAllOrganized,
    historyStack,
    redoStack,
  } = useGuandanStore();

  const levelRank = table.currentLevelRank;
  const currentPos = table.currentPlayer;

  // ── 选牌状态（当前出牌方的选中 ids） ─────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [violationIds, setViolationIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showWildcardPopover, setShowWildcardPopover] = useState(false);
  const [pendingCards, setPendingCards] = useState<Card[]>([]);
  const [shakeKey, setShakeKey] = useState(0);

  // currentPlayer 切换时清空选牌状态，防止混乱
  useEffect(() => {
    setSelectedIds(new Set());
    setViolationIds(new Set());
    setErrorMsg(null);
  }, [currentPos]);

  // 当前出牌方的手牌
  const currentCards = players[currentPos].handCards;

  // 桌面最后一次有效出牌的牌型（用于压制判断）
  const lastValidAction = [...table.actionHistory]
    .reverse()
    .find((a) => a.playType !== 'Pass' && a.playedCards.length > 0);
  const lastPattern: PatternResult | null = lastValidAction
    ? identifyPattern(lastValidAction.playedCards, levelRank)
    : null;

  // ── 切换选牌（仅当前出牌方） ──────────────────────────────
  const handleToggleCard = useCallback((card: Card) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
    setViolationIds(new Set());
    setErrorMsg(null);
  }, []);

  // ── 上帝之手：切换当前出牌方 ─────────────────────────────
  function handleSetCurrentPlayer(pos: PlayerPosition) {
    if (pos === currentPos) return;
    setCurrentPlayer(pos);
  }

  // ── 出牌主逻辑 ──────────────────────────────────────────
  function handlePlayCards() {
    const selected = currentCards.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) {
      triggerError('请先选择要出的牌');
      return;
    }

    const pattern = identifyPattern(selected, levelRank);
    const hasWild = selected.some((c) => c.isWildcard);

    let isViolation = false;
    let errorText: string | null = null;

    if (!pattern.isValid || pattern.type === 'Invalid') {
      isViolation = true;
      errorText = `非法牌型！${selected.length} 张牌无法组合`;
    } else if (lastPattern && !canBeat(pattern, lastPattern)) {
      isViolation = true;
      errorText = `无法压制 ${PLAY_TYPE_LABEL[lastPattern.type]}，已标记违规`;
    }

    if (isViolation) {
      setViolationIds(new Set(selected.map((c) => c.id)));
      setErrorMsg(errorText);
      setShakeKey((k) => k + 1);
      // 错误包容：短暂高亮后仍然出牌
      setTimeout(() => {
        executePlay(selected, true, pattern.type);
      }, 500);
      return;
    }

    // 合法且含逢人配 → 先弹窗指定替代
    if (hasWild) {
      setPendingCards(selected);
      setShowWildcardPopover(true);
      return;
    }

    executePlay(selected, false, pattern.type);
  }

  // ── 逢人配指定确认 ───────────────────────────────────────
  function handleWildcardSelect(suggestion: WildcardSuggestion) {
    setShowWildcardPopover(false);
    const finalCards = pendingCards.map((c) =>
      c.isWildcard
        ? { ...c, actingAs: { suit: suggestion.suit, rank: suggestion.rank } }
        : c
    );
    const pattern = identifyPattern(finalCards, levelRank);
    // 逢人配指定后若仍为非法牌型，应与普通非法牌型一致：红框违规提示
    const isViolation = !pattern.isValid || pattern.type === 'Invalid';
    executePlay(finalCards, isViolation, pattern.type);
    setPendingCards([]);
  }

  function handleWildcardCancel() {
    setShowWildcardPopover(false);
    setPendingCards([]);
  }

  // ── 执行出牌（调用 store action，自动推进轮转） ───────────
  function executePlay(cards: Card[], isViolation: boolean, playType: PlayTypeName) {
    saveSnapshot(); // 出牌前保存快照，支持撤销
    playCards(currentPos, cards, playType, isViolation);
    setSelectedIds(new Set());
    setViolationIds(new Set());
    setErrorMsg(null);
  }

  // ── 不出 ─────────────────────────────────────────────────
  function handlePass() {
    saveSnapshot();
    passAction(currentPos);
    setSelectedIds(new Set());
    setErrorMsg(null);
  }

  // ── 错误提示 ─────────────────────────────────────────────
  function triggerError(msg: string) {
    setErrorMsg(msg);
    setShakeKey((k) => k + 1);
    setTimeout(() => setErrorMsg(null), 3000);
  }

  // ── 本轮各家出牌（南→东→北→西 各出一张为一轮） ─────────────
  const lastRound = table.actionHistory.slice(-4);
  const lastPlayByPlayer: Partial<Record<PlayerPosition, PlayAction>> = {};
  for (const a of lastRound) {
    lastPlayByPlayer[a.playerId] = a;
  }

  // ── 已选牌实时牌型识别 ────────────────────────────────────
  const selectedCards = currentCards.filter((c) => selectedIds.has(c.id));
  const previewPattern =
    selectedCards.length > 0
      ? identifyPattern(selectedCards, levelRank)
      : null;

  // ── 理牌 / 恢复 按钮逻辑（拆分为两个独立按钮）────────────────
  const currentOrganized = organizedGroups[currentPos];
  const hasAnyOrganized = currentOrganized.length > 0;
  const selectedIdSet = new Set(selectedIds);
  const selectedIdsArr = [...selectedIds];

  // 选中的牌是否完全匹配某个已理牌组
  const matchedOrganizedGroup = currentOrganized.find((g) => {
    if (g.cardIds.length !== selectedIdSet.size) return false;
    return g.cardIds.every((id) => selectedIdSet.has(id));
  });

  // 选中的牌是否与任意已理牌组有重叠
  const overlapsOrganized = currentOrganized.some((g) =>
    g.cardIds.some((id) => selectedIdSet.has(id))
  );

  // 理牌按钮：仅当选中未理牌的合法牌型时可点
  const canOrganize =
    selectedCards.length > 0 &&
    previewPattern?.isValid &&
    previewPattern.type !== 'Invalid' &&
    !overlapsOrganized;

  // 恢复按钮：选中已理牌合法整组 或 未选任何牌且有理牌 时可点
  const canRestoreOne = matchedOrganizedGroup != null && previewPattern?.isValid;
  const canRestoreAll = selectedIds.size === 0 && hasAnyOrganized;
  const canRestore = canRestoreOne || canRestoreAll;

  function handleOrganize() {
    if (!canOrganize || !previewPattern) return;
    organizeCards(currentPos, selectedIdsArr, {
      type: previewPattern.type,
      primaryValue: previewPattern.primaryValue,
      length: previewPattern.length,
    });
    setSelectedIds(new Set());
  }

  function handleRestore() {
    if (canRestoreOne && matchedOrganizedGroup) {
      restoreOrganizedGroup(currentPos, matchedOrganizedGroup.cardIds);
      setSelectedIds(new Set());
    } else if (canRestoreAll) {
      restoreAllOrganized(currentPos);
    }
  }

  return (
    <div className="relative w-full flex-1 min-h-0 bg-[#0D5B46] flex flex-col select-none overflow-hidden">
      {/* 桌面光晕 */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 70%)',
        }}
      />

      {/* ── 四点锚定出牌区：全覆盖透明层，绝对定位脱离文档流 ───────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-40">
        {/* 南家出牌区：在南家手牌和按钮正上方，绝不遮挡按钮 */}
        <div className="absolute bottom-[38%] left-1/2 -translate-x-1/2 flex flex-row justify-center scale-90 origin-bottom">
          <PlayedCardZone action={lastPlayByPlayer.SOUTH} levelRank={levelRank} />
        </div>
        {/* 北家出牌区：在北家手牌正下方 */}
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 flex flex-row justify-center scale-90 origin-top">
          <PlayedCardZone action={lastPlayByPlayer.NORTH} levelRank={levelRank} />
        </div>
        {/* 西家出牌区：在西家手牌右侧（东面） */}
        <div className="absolute left-[22%] top-1/2 -translate-y-1/2 flex flex-row justify-start scale-90 origin-left">
          <PlayedCardZone action={lastPlayByPlayer.WEST} levelRank={levelRank} />
        </div>
        {/* 东家出牌区：在东家手牌左侧（西面） */}
        <div className="absolute right-[22%] top-1/2 -translate-y-1/2 flex flex-row justify-end scale-90 origin-right">
          <PlayedCardZone action={lastPlayByPlayer.EAST} levelRank={levelRank} />
        </div>
      </div>

      {/* ── 口字形布局：西/东列固定最小宽度，防止出牌后间隙收缩、牌被遮挡 ───── */}
      <div className="grid grid-cols-[minmax(140px,0.4fr)_minmax(100px,1.2fr)_minmax(140px,0.4fr)] grid-rows-[auto_1fr_auto] gap-2 px-2 flex-1 min-h-0 z-10 w-full max-w-full">
        {/* 北家（顶部，手牌区域较短，仅占中间列宽度） */}
        <div className="col-start-1 col-span-3 row-start-1 flex flex-col items-center justify-center pt-3 pb-1 min-w-0 gap-1 w-full">
          <div className="w-fit min-w-0 max-w-[min(100%,calc(100%-140px))] mx-auto">
          <HandArea
            position="NORTH"
            cards={players.NORTH.handCards}
            isRevealed={players.NORTH.isRevealed}
            levelRank={levelRank}
            isCurrent={currentPos === 'NORTH'}
            selectedCardIds={selectedIds}
            onToggleCard={handleToggleCard}
            onToggleReveal={() => toggleReveal('NORTH')}
            onSetAsCurrent={() => handleSetCurrentPlayer('NORTH')}
            violatingCardIds={violationIds}
            layoutMode="ns-column"
            organizedGroups={organizedGroups.NORTH}
          />
          </div>
        </div>

        {/* 西家（左侧中央，同数字一行，行从下到上从小到大，可左右滑动查看全部牌） */}
        <div className="relative col-start-1 row-start-1 row-span-3 flex flex-row items-center justify-start min-w-[140px] overflow-x-auto overflow-y-visible gap-2 pl-5 shrink-0 z-30">
          <div className="shrink-0">
          <HandArea
            position="WEST"
            cards={players.WEST.handCards}
            isRevealed={players.WEST.isRevealed}
            levelRank={levelRank}
            isCurrent={currentPos === 'WEST'}
            selectedCardIds={selectedIds}
            onToggleCard={handleToggleCard}
            onToggleReveal={() => toggleReveal('WEST')}
            onSetAsCurrent={() => handleSetCurrentPlayer('WEST')}
            violatingCardIds={violationIds}
            layoutMode="we-row"
            organizedGroups={organizedGroups.WEST}
          />
          </div>
        </div>

        {/* 东家（右侧中央，同数字一行，行从下到上从小到大，可左右滑动查看全部牌，结构与西家对称） */}
        <div className="relative col-start-3 row-start-1 row-span-3 flex flex-row-reverse items-center justify-start min-w-[140px] overflow-x-auto overflow-y-visible gap-2 pr-5 shrink-0 z-30">
          <div className="shrink-0">
          <HandArea
            position="EAST"
            cards={players.EAST.handCards}
            isRevealed={players.EAST.isRevealed}
            levelRank={levelRank}
            isCurrent={currentPos === 'EAST'}
            selectedCardIds={selectedIds}
            onToggleCard={handleToggleCard}
            onToggleReveal={() => toggleReveal('EAST')}
            onSetAsCurrent={() => handleSetCurrentPlayer('EAST')}
            violatingCardIds={violationIds}
            layoutMode="we-row"
            organizedGroups={organizedGroups.EAST}
          />
          </div>
        </div>

        {/* 中央空白（需压制提示已隐藏） */}
        <div className="col-start-2 row-start-2 flex flex-col items-center justify-center gap-2 min-h-[80px] py-2" />

        {/* 南家（贴底，手牌展示区下边界对齐屏幕底部，横向区域扩大） */}
        <div className="col-start-1 col-span-3 row-start-3 flex flex-col items-center gap-2 pt-4 pb-3 justify-end w-full min-w-0">
          {/* 操作台：终极保护，永远浮在最表面，不可被遮挡 */}
        <div className="relative z-[999] pointer-events-auto flex items-center gap-2 shrink-0">
          {/* 错误气泡 */}
          {errorMsg && (
            <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap animate-fade-in z-20">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* 不出 */}
          <button
            onClick={handlePass}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
          >
            不出
            <span className="ml-1 text-gray-400 text-xs">
              ({POSITION_ZH[currentPos]})
            </span>
          </button>

          {/* 出牌（带 shake 动画） */}
          <button
            key={shakeKey}
            onClick={handlePlayCards}
            className={[
              'px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold text-sm rounded-xl transition-colors shadow-lg',
              shakeKey > 0 ? SHAKE_CLASS : '',
            ].join(' ')}
          >
            出牌
            <span className="ml-1 font-normal text-gray-700 text-xs">
              ({POSITION_ZH[currentPos]})
            </span>
            {' ▶'}
          </button>

          {/* 理牌 */}
          <button
            onClick={canOrganize ? handleOrganize : undefined}
            title={canOrganize ? '将选中合法牌型理牌' : '请选中未理牌的合法牌型'}
            className={[
              'px-4 py-2 text-sm rounded-xl transition-colors',
              canOrganize
                ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            理牌
          </button>

          {/* 恢复 */}
          <button
            onClick={canRestore ? handleRestore : undefined}
            title={
              canRestore
                ? canRestoreOne
                  ? '恢复选中牌型到散牌区'
                  : '恢复全部理牌到散牌区'
                : '请选中已理牌型或未选牌时点击全部恢复'
            }
            className={[
              'px-4 py-2 text-sm rounded-xl transition-colors',
              canRestore
                ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            恢复
          </button>

          {/* 撤销 */}
          <button
            onClick={undo}
            disabled={historyStack.length === 0}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-xl transition-colors"
            title="撤销上一步"
          >
            ↩ 撤销
          </button>

          {/* 重做 */}
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-xl transition-colors"
            title="重做"
          >
            ↪ 重做
          </button>
        </div>

        {/* 已选牌预览气泡：非法牌型时与出牌区违规提示样式一致（红框白字） */}
        {selectedIds.size > 0 && (
          <div
            className={[
              'text-xs px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1',
              previewPattern?.isValid
                ? 'text-yellow-300 bg-gray-900/70'
                : 'ring-2 ring-red-500 bg-red-900/30 text-red-100',
            ].join(' ')}
          >
            已选 {selectedIds.size} 张 ·{' '}
            {previewPattern?.isValid
              ? `${PLAY_TYPE_LABEL[previewPattern.type]}（主值 ${previewPattern.primaryValue}）`
              : (
                <>
                  非法牌型
                  <span className="text-amber-400">⚠️</span>
                </>
              )}
          </div>
        )}

        {/* 南家手牌（贴底，与北家同宽，以较短的北家为准） */}
        <div className="w-fit min-w-0 max-w-[min(100%,calc(100%-140px))] mx-auto">
          <HandArea
            position="SOUTH"
            cards={players.SOUTH.handCards}
            isRevealed={players.SOUTH.isRevealed}
            levelRank={levelRank}
            isCurrent={currentPos === 'SOUTH'}
            selectedCardIds={selectedIds}
            onToggleCard={handleToggleCard}
            onToggleReveal={() => toggleReveal('SOUTH')}
            onSetAsCurrent={() => handleSetCurrentPlayer('SOUTH')}
            violatingCardIds={violationIds}
            layoutMode="ns-column"
            organizedGroups={organizedGroups.SOUTH}
          />
        </div>
        </div>
      </div>

      {/* 逢人配弹窗 */}
      {showWildcardPopover && (
        <WildcardPopover
          cards={pendingCards}
          currentLevelRank={levelRank}
          onSelect={handleWildcardSelect}
          onCancel={handleWildcardCancel}
        />
      )}
    </div>
  );
}
