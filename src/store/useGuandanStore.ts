import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  Card,
  GameSnapshot,
  OrganizedGroup,
  Player,
  PlayerPosition,
  PlayTypeName,
  Rank,
  Suit,
  TableState,
} from '@/types/guandan';
import { sortCards } from '@/utils/guandanRules';

// ============================================================
// 辅助：生成掼蛋标准 108 张牌
// ============================================================
const SUITS: Suit[] = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const BASE_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  Small: 16, Big: 17,
};

export function generateInitialDeck(): Card[] {
  const cards: Card[] = [];
  // 两副牌（deckIndex: 1 和 2）
  for (let deckIndex = 1; deckIndex <= 2; deckIndex++) {
    // 普通牌 52 张
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `${suit}-${rank}-${deckIndex}`,
          suit,
          rank,
          value: BASE_VALUES[rank],
          isWildcard: false,
        });
      }
    }
    // 大小王各一张
    cards.push({
      id: `Joker-Small-${deckIndex}`,
      suit: 'Joker',
      rank: 'Small',
      value: 16,
      isWildcard: false,
    });
    cards.push({
      id: `Joker-Big-${deckIndex}`,
      suit: 'Joker',
      rank: 'Big',
      value: 17,
      isWildcard: false,
    });
  }
  return cards; // 108 张
}

// ============================================================
// cardPool 键格式："{Suit}-{Rank}"
// ============================================================
function buildInitialCardPool(): Record<string, number> {
  const pool: Record<string, number> = {};
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      pool[`${suit}-${rank}`] = 2;
    }
  }
  pool['Joker-Small'] = 2;
  pool['Joker-Big'] = 2;
  return pool;
}

export function cardPoolKey(suit: Suit, rank: Rank): string {
  return `${suit}-${rank}`;
}

// ============================================================
// 初始玩家状态
// ============================================================
function buildInitialPlayers(): Record<PlayerPosition, Player> {
  return {
    EAST:  { position: 'EAST',  handCards: [], isRevealed: false },
    SOUTH: { position: 'SOUTH', handCards: [], isRevealed: true  },
    WEST:  { position: 'WEST',  handCards: [], isRevealed: false },
    NORTH: { position: 'NORTH', handCards: [], isRevealed: false },
  };
}

const INITIAL_TABLE: TableState = {
  currentLevelRank: '2',
  currentPlayer: 'SOUTH',
  actionHistory: [],
};

// ============================================================
// 深拷贝工具（用于快照）
// ============================================================
function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

// ============================================================
// Store 类型定义
// ============================================================
export interface GuandanState {
  players: Record<PlayerPosition, Player>;
  table: TableState;
  /** 是否处于自定义极速排牌模式 */
  isSetupMode: boolean;
  /** 极速排牌矩阵剩余卡池；key="{Suit}-{Rank}"，value=剩余数量(0~2) */
  cardPool: Record<string, number>;
  /** 各玩家的理牌分组 */
  organizedGroups: Record<PlayerPosition, OrganizedGroup[]>;
  historyStack: GameSnapshot[];
  redoStack: GameSnapshot[];
}

export interface GuandanActions {
  /** 设置当前打几（级牌），并对所有手牌重新排序 */
  setLevel: (rank: Rank) => void;
  /** 切换某玩家的明暗牌状态 */
  toggleReveal: (position: PlayerPosition) => void;
  /** 切换排牌/出牌模式 */
  toggleSetupMode: () => void;
  /** 将一张牌从 cardPool 分配给指定玩家（自动理牌） */
  assignCardToPlayer: (suit: Suit, rank: Rank, targetPlayer: PlayerPosition) => void;
  /** 从玩家手牌中移除一张牌，归还 cardPool */
  returnCardFromPlayer: (cardId: string, playerPosition: PlayerPosition) => void;
  /** 清空指定玩家的手牌 */
  clearPlayerHand: (position: PlayerPosition) => void;
  /** 一键清空全盘 */
  clearAllHands: () => void;
  /** 随机发牌：将 cardPool 剩余牌随机分配给四家（自动理牌） */
  randomDeal: () => void;
  /**
   * 执行出牌：移除手牌、记录 action、自动推进 currentPlayer。
   * playType 由调用方（MainTable）计算后传入。
   */
  playCards: (
    position: PlayerPosition,
    cards: Card[],
    playType: PlayTypeName,
    isRuleViolation: boolean
  ) => void;
  /** 不出（Pass）：记录 action、自动推进 currentPlayer */
  passAction: (position: PlayerPosition) => void;
  /** 清空出牌记录与展示区（手牌、排牌设置、当前出牌方均不变） */
  clearPlayHistory: () => void;
  /** 上帝之手：直接将任意玩家设为当前出牌方 */
  setCurrentPlayer: (position: PlayerPosition) => void;
  /** 保存快照到历史栈 */
  saveSnapshot: (remark?: string) => void;
  /** 撤销（恢复后重新排序） */
  undo: () => void;
  /** 重做（恢复后重新排序） */
  redo: () => void;
  /** 从云端快照完整覆盖当前状态 */
  loadSnapshot: (snapshot: GameSnapshot) => void;
  /** 理牌：将选中的合法牌型加入理牌区（不重叠） */
  organizeCards: (position: PlayerPosition, cardIds: string[], pattern: { type: PlayTypeName; primaryValue: number; length: number }) => void;
  /** 恢复单个理牌组到非理牌区 */
  restoreOrganizedGroup: (position: PlayerPosition, cardIds: string[]) => void;
  /** 恢复该玩家全部理牌到非理牌区 */
  restoreAllOrganized: (position: PlayerPosition) => void;
}

type GuandanStore = GuandanState & GuandanActions;

// ============================================================
// Zustand Store（使用 immer 中间件简化不可变更新）
// ============================================================

/** 出牌轮转顺序：SOUTH → EAST → NORTH → WEST → SOUTH */
const PLAYER_ORDER: PlayerPosition[] = ['SOUTH', 'EAST', 'NORTH', 'WEST'];
const ALL_POSITIONS: PlayerPosition[] = ['EAST', 'SOUTH', 'WEST', 'NORTH'];

/** 推进到下一位出牌玩家 */
function nextPlayer(current: PlayerPosition): PlayerPosition {
  const idx = PLAYER_ORDER.indexOf(current);
  return PLAYER_ORDER[(idx + 1) % 4];
}

/**
 * 对 immer draft 中所有玩家的手牌执行自动理牌。
 * 注：immer draft 数组可直接赋值替换。
 */
function sortAllHands(
  players: Record<PlayerPosition, Player>,
  levelRank: Rank
): void {
  for (const pos of ALL_POSITIONS) {
    players[pos].handCards = sortCards(players[pos].handCards, levelRank);
  }
}

/** 根据当前四家手牌重算 cardPool（用于 undo/redo 后同步牌堆） */
function recalcCardPoolFromHands(
  players: Record<PlayerPosition, Player>
): Record<string, number> {
  const full = buildInitialCardPool();
  for (const pos of ALL_POSITIONS) {
    for (const card of players[pos].handCards) {
      const key = cardPoolKey(card.suit, card.rank);
      if (full[key] !== undefined && full[key] > 0) full[key]--;
    }
  }
  return full;
}

export const useGuandanStore = create<GuandanStore>()(
  immer((set, get) => ({
    // ── 初始 State ──────────────────────────────────────────
    players: buildInitialPlayers(),
    table: deepClone(INITIAL_TABLE),
    isSetupMode: true,
    cardPool: buildInitialCardPool(),
    organizedGroups: {
      EAST: [],
      SOUTH: [],
      WEST: [],
      NORTH: [],
    },
    historyStack: [],
    redoStack: [],

    // ── Actions ─────────────────────────────────────────────

    setLevel: (rank) => {
      set((state) => {
        state.table.currentLevelRank = rank;
        // 重新标记每张牌的 isWildcard / value
        for (const pos of ALL_POSITIONS) {
          state.players[pos].handCards = state.players[pos].handCards.map((card) => {
            if (card.suit === 'Joker') return card;
            if (card.rank === rank) {
              return {
                ...card,
                isWildcard: card.suit === 'Hearts',
                value: 15,
              };
            }
            return { ...card, isWildcard: false, value: BASE_VALUES[card.rank] };
          });
        }
        // 重新理牌
        sortAllHands(state.players, rank);
      });
    },

    toggleReveal: (position) => {
      set((state) => {
        state.players[position].isRevealed = !state.players[position].isRevealed;
      });
    },

    toggleSetupMode: () => {
      set((state) => {
        state.isSetupMode = !state.isSetupMode;
      });
    },

    assignCardToPlayer: (suit, rank, targetPlayer) => {
      const key = cardPoolKey(suit, rank);
      const state = get();
      if ((state.cardPool[key] ?? 0) <= 0) return;

      // 全局已发同种牌总数，用于生成唯一 deckIndex
      const globalCount = ALL_POSITIONS.reduce(
        (acc, pos) =>
          acc + state.players[pos].handCards.filter(
            (c) => c.suit === suit && c.rank === rank
          ).length,
        0
      );
      const deckIndex = globalCount + 1;

      const isLevelRank = rank === state.table.currentLevelRank;
      const isWildcard = isLevelRank && suit === 'Hearts';

      const newCard: Card = {
        id: `${suit}-${rank}-${deckIndex}`,
        suit,
        rank,
        value:
          rank === 'Small' || rank === 'Big'
            ? BASE_VALUES[rank]
            : isLevelRank
              ? 15
              : BASE_VALUES[rank],
        isWildcard,
      };

      set((s) => {
        s.cardPool[key] = (s.cardPool[key] ?? 0) - 1;
        s.players[targetPlayer].handCards.push(newCard);
        // 每次添加牌后自动理牌
        s.players[targetPlayer].handCards = sortCards(
          s.players[targetPlayer].handCards,
          s.table.currentLevelRank
        );
      });
    },

    returnCardFromPlayer: (cardId, playerPosition) => {
      set((state) => {
        const idx = state.players[playerPosition].handCards.findIndex(
          (c) => c.id === cardId
        );
        if (idx === -1) return;
        const [removed] = state.players[playerPosition].handCards.splice(idx, 1);
        const key = cardPoolKey(removed.suit, removed.rank);
        const current = state.cardPool[key] ?? 0;
        state.cardPool[key] = Math.min(2, current + 1); // 两副牌每种牌最多 2 张
        // 退牌后无需重排（顺序不变，只是少了一张）
      });
    },

    clearPlayerHand: (position) => {
      set((state) => {
        for (const card of state.players[position].handCards) {
          const key = cardPoolKey(card.suit, card.rank);
          const current = state.cardPool[key] ?? 0;
          state.cardPool[key] = Math.min(2, current + 1); // 两副牌每种牌最多 2 张
        }
        state.players[position].handCards = [];
        state.organizedGroups[position] = [];
        state.table.actionHistory = [];
      });
    },

    clearAllHands: () => {
      set((state) => {
        for (const pos of ALL_POSITIONS) {
          state.players[pos].handCards = [];
          state.organizedGroups[pos] = [];
        }
        state.cardPool = buildInitialCardPool();
        state.table.actionHistory = [];
      });
    },

    randomDeal: () => {
      set((state) => {
        // 一键随机发牌：先清空所有手牌，卡池恢复为两副牌 108 张
        for (const pos of ALL_POSITIONS) {
          state.players[pos].handCards = [];
        }
        state.cardPool = buildInitialCardPool();

        // 从卡池按每种牌的数量收集（每种牌型最多 2 张，共 54 种 × 2 = 108 张）
        const remaining: { suit: Suit; rank: Rank }[] = [];
        const poolEntries: { suit: Suit; rank: Rank }[] = [];
        for (const suit of SUITS) {
          for (const rank of RANKS) {
            poolEntries.push({ suit, rank });
          }
        }
        poolEntries.push({ suit: 'Joker', rank: 'Small' });
        poolEntries.push({ suit: 'Joker', rank: 'Big' });
        for (const { suit, rank } of poolEntries) {
          const key = cardPoolKey(suit, rank);
          const qty = state.cardPool[key] ?? 0;
          for (let i = 0; i < qty; i++) {
            remaining.push({ suit, rank });
          }
        }

        // Fisher-Yates 洗牌
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }

        // 掼蛋规则：108 张牌一次性发完，每人 27 张
        const cardsPerPlayer = 27;
        const cardsToDeal = remaining.slice(0, cardsPerPlayer * 4);

        // 轮流发牌（每人恰好 27 张）
        cardsToDeal.forEach((item, i) => {
          const pos = PLAYER_ORDER[i % 4];
          const isLevelRank = item.rank === state.table.currentLevelRank;
          const isWildcard = isLevelRank && item.suit === 'Hearts';
          const deckIndex =
            ALL_POSITIONS.reduce(
              (acc, p) =>
                acc +
                state.players[p].handCards.filter(
                  (c) => c.suit === item.suit && c.rank === item.rank
                ).length,
              0
            ) + 1;
          state.players[pos].handCards.push({
            id: `${item.suit}-${item.rank}-${deckIndex}`,
            suit: item.suit,
            rank: item.rank,
            value:
              item.rank === 'Small' || item.rank === 'Big'
                ? BASE_VALUES[item.rank]
                : isLevelRank
                  ? 15
                  : BASE_VALUES[item.rank],
            isWildcard,
          });
        });

        // 发完后卡池归零（两副牌已全部发出）
        const newPool = buildInitialCardPool();
        for (const key of Object.keys(newPool)) {
          newPool[key] = 0;
        }
        state.cardPool = newPool;

        state.table.actionHistory = []; // 清空出牌记录

        sortAllHands(state.players, state.table.currentLevelRank);
      });
    },

    playCards: (position, cards, playType, isRuleViolation) => {
      set((state) => {
        const removedIds = new Set(cards.map((c) => c.id));
        state.players[position].handCards = state.players[position].handCards.filter(
          (c) => !removedIds.has(c.id)
        );
        // 移除包含已打出牌的理牌组
        state.organizedGroups[position] = state.organizedGroups[position].filter(
          (g) => !g.cardIds.some((id) => removedIds.has(id))
        );
        // 教学牌桌：打出的牌自动归还排牌设置的牌堆，保证平衡
        for (const card of cards) {
          const key = cardPoolKey(card.suit, card.rank);
          const current = state.cardPool[key] ?? 0;
          state.cardPool[key] = Math.min(2, current + 1);
        }
        // 记录动作
        state.table.actionHistory.push({
          actionId: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          playerId: position,
          playedCards: cards,
          playType,
          isRuleViolation,
          timestamp: Date.now(),
        });
        // 自动推进到下一家
        state.table.currentPlayer = nextPlayer(position);
      });
    },

    passAction: (position) => {
      set((state) => {
        state.table.actionHistory.push({
          actionId: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          playerId: position,
          playedCards: [],
          playType: 'Pass',
          isRuleViolation: false,
          timestamp: Date.now(),
        });
        // 不出也推进到下一家
        state.table.currentPlayer = nextPlayer(position);
      });
    },

    clearPlayHistory: () => {
      set((state) => {
        state.table.actionHistory = [];
      });
    },

    setCurrentPlayer: (position) => {
      set((state) => {
        state.table.currentPlayer = position;
      });
    },

    saveSnapshot: (remark) => {
      const state = get();
      const snapshot: GameSnapshot = {
        snapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        playersState: deepClone(state.players),
        tableState: deepClone(state.table),
        organizedGroupsState: deepClone(state.organizedGroups),
        remark,
      };
      set((s) => {
        s.historyStack.push(snapshot);
        s.redoStack = [];
      });
    },

    undo: () => {
      set((state) => {
        if (state.historyStack.length === 0) return;
        const currentSnap: GameSnapshot = {
          snapshotId: `redo-${Date.now()}`,
          timestamp: Date.now(),
          playersState: deepClone(state.players),
          tableState: deepClone(state.table),
          organizedGroupsState: deepClone(state.organizedGroups),
        };
        state.redoStack.push(currentSnap);
        const prev = state.historyStack.pop();
        if (prev) {
          state.players = prev.playersState;
          state.table = prev.tableState;
          if (prev.organizedGroupsState) state.organizedGroups = prev.organizedGroupsState;
          state.cardPool = recalcCardPoolFromHands(state.players);
          sortAllHands(state.players, state.table.currentLevelRank);
        }
      });
    },

    redo: () => {
      set((state) => {
        if (state.redoStack.length === 0) return;
        const currentSnap: GameSnapshot = {
          snapshotId: `hist-${Date.now()}`,
          timestamp: Date.now(),
          playersState: deepClone(state.players),
          tableState: deepClone(state.table),
          organizedGroupsState: deepClone(state.organizedGroups),
        };
        state.historyStack.push(currentSnap);
        const next = state.redoStack.pop();
        if (next) {
          state.players = next.playersState;
          state.table = next.tableState;
          if (next.organizedGroupsState) state.organizedGroups = next.organizedGroupsState;
          state.cardPool = recalcCardPoolFromHands(state.players);
          sortAllHands(state.players, state.table.currentLevelRank);
        }
      });
    },

    loadSnapshot: (snapshot) => {
      set((state) => {
        state.players = deepClone(snapshot.playersState);
        state.table = deepClone(snapshot.tableState);
        if (snapshot.organizedGroupsState) state.organizedGroups = deepClone(snapshot.organizedGroupsState);
        state.historyStack = [];
        state.redoStack = [];
        const pool = buildInitialCardPool();
        for (const pos of ALL_POSITIONS) {
          for (const card of snapshot.playersState[pos].handCards) {
            const key = cardPoolKey(card.suit, card.rank);
            if (pool[key] !== undefined && pool[key] > 0) pool[key]--;
          }
        }
        state.cardPool = pool;
        sortAllHands(state.players, state.table.currentLevelRank);
      });
    },

    organizeCards: (position, cardIds, pattern) => {
      set((state) => {
        const groups = state.organizedGroups[position];
        const selectedSet = new Set(cardIds);
        for (const g of groups) {
          for (const id of g.cardIds) {
            if (selectedSet.has(id)) return; // 重叠，不执行
          }
        }
        const isBomb = pattern.type === 'Bomb' || pattern.type === 'StraightFlush' || pattern.type === 'KingBomb';
        groups.push({
          cardIds: [...cardIds],
          type: pattern.type,
          primaryValue: pattern.primaryValue,
          length: pattern.length,
          isBomb,
        });
      });
    },

    restoreOrganizedGroup: (position, cardIds) => {
      set((state) => {
        const groups = state.organizedGroups[position];
        const idSet = new Set(cardIds);
        state.organizedGroups[position] = groups.filter((g) => {
          if (g.cardIds.length !== idSet.size) return true;
          return !g.cardIds.every((id) => idSet.has(id));
        });
      });
    },

    restoreAllOrganized: (position) => {
      set((state) => {
        state.organizedGroups[position] = [];
      });
    },
  }))
);
