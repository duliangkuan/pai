'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, PatternResult, PlayAction, PlayerPosition, PlayTypeName } from '@/types/guandan';
import { useGuandanStore } from '@/store/useGuandanStore';
import { canBeat, identifyPattern } from '@/utils/guandanRules';
import { WildcardSuggestion } from '@/utils/guandanRules';
import HandArea from './HandArea';
import PlayedCardZone from './PlayedCardZone';
import WildcardPopover from './WildcardPopover';
import CardTile from './CardTile';
import { SUIT_SYMBOL } from './CardTile';

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
    undo,
    redo,
    toggleReveal,
    setCurrentPlayer,
    playCards,
    passAction,
    saveSnapshot,
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
    executePlay(finalCards, false, pattern.type);
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

  return (
    <div className="relative w-full min-h-screen bg-[#0D5B46] flex flex-col select-none overflow-y-auto overflow-x-hidden pb-32">
      {/* 桌面光晕 */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 70%)',
        }}
      />

      {/* ── 口字形布局：上北下南左西右东，牌竖着展示，上下滚动 ───── */}
      <div className="grid grid-cols-[minmax(90px,1fr)_minmax(0,1fr)_minmax(90px,1fr)] grid-rows-[auto_1fr_auto] gap-2 px-2 flex-1 z-10 min-h-0 w-full max-w-full">
        {/* 北家（顶部中央，同数字一列，列从右向左从小到大） */}
        <div className="col-start-2 row-start-1 flex flex-col items-center justify-center pt-3 pb-1 min-w-0 gap-1">
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
          />
          <PlayedCardZone action={lastPlayByPlayer.NORTH} levelRank={levelRank} />
        </div>

        {/* 西家（左侧中央，同数字一行，行从下到上从小到大） */}
        <div className="col-start-1 row-start-1 row-span-3 flex flex-row items-center justify-center min-w-0 overflow-visible gap-2">
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
          />
          <PlayedCardZone action={lastPlayByPlayer.WEST} levelRank={levelRank} />
        </div>

        {/* 东家（右侧中央，同数字一行，行从下到上从小到大） */}
        <div className="col-start-3 row-start-1 row-span-3 flex flex-row items-center justify-center min-w-0 overflow-visible gap-2">
          <PlayedCardZone action={lastPlayByPlayer.EAST} levelRank={levelRank} />
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
          />
        </div>

        {/* 中央：需压制提示（出牌记录已移至弹窗） */}
        <div className="col-start-2 row-start-2 flex flex-col items-center justify-center gap-2 min-h-[80px] py-2">
          {lastPattern && lastPattern.type !== 'Pass' && (
            <div className="text-green-300 text-xs bg-green-900/40 px-3 py-1 rounded-full">
              需压制：{PLAY_TYPE_LABEL[lastPattern.type]}（{lastPattern.length}张，
              主值 {lastPattern.primaryValue}）
            </div>
          )}
        </div>

        {/* 南家（底部中央，适当下移保证整体比例） */}
        <div className="col-start-2 row-start-3 pb-4 pt-8 flex flex-col items-center gap-2">
          <PlayedCardZone action={lastPlayByPlayer.SOUTH} levelRank={levelRank} />
          {/* 操作台 */}
        <div className="relative flex items-center gap-2">
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

        {/* 南家手牌（同数字一列，列从右向左从小到大） */}
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
        />

        {/* 已选牌预览气泡 */}
        {selectedIds.size > 0 && (
          <div className="text-xs text-yellow-300 bg-gray-900/70 px-3 py-1 rounded-full">
            已选 {selectedIds.size} 张 ·{' '}
            {previewPattern?.isValid
              ? `${PLAY_TYPE_LABEL[previewPattern.type]}（主值 ${previewPattern.primaryValue}）`
              : '非法牌型'}
          </div>
        )}
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
