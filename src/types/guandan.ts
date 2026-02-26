// ============================================================
// 掼蛋教学辅助演示工具 — 全局基础数据结构
// ============================================================

/** 扑克花色：黑桃、红桃、梅花、方块、大小王 */
export type Suit = 'Spades' | 'Hearts' | 'Clubs' | 'Diamonds' | 'Joker';

/** 牌面点数：2~A，以及大小王 */
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A'
  | 'Small' | 'Big';

/** 玩家方位 */
export type PlayerPosition = 'EAST' | 'SOUTH' | 'WEST' | 'NORTH';

/**
 * 单张实体牌
 * id 格式：{Suit}-{Rank}-{deckIndex}，保证全局唯一
 */
export interface Card {
  /** 全局唯一标识，如 'Hearts-5-1' / 'Hearts-5-2' */
  id: string;
  suit: Suit;
  rank: Rank;
  /** 基础权重，用于比大小；逢人配百搭时动态覆盖 */
  value: number;
  /** 是否是逢人配（红桃级牌） */
  isWildcard: boolean;
  /** 逢人配被打出时「当作」哪张牌使用 */
  actingAs?: { suit: Suit; rank: Rank };
}

/** 玩家运行时状态 */
export interface Player {
  position: PlayerPosition;
  handCards: Card[];
  /** 明暗牌开关；true = 明牌 */
  isRevealed: boolean;
}

/** 牌型字符串字面量联合类型 */
export type PlayTypeName =
  | 'Single'
  | 'Pair'
  | 'Triple'
  | 'TripleWithPair'
  | 'Straight'
  | 'StraightFlush'
  | 'Tube'
  | 'Plate'
  | 'Bomb'
  | 'KingBomb'
  | 'Pass'
  | 'Invalid';

/** 单次出牌动作记录 */
export interface PlayAction {
  actionId: string;
  playerId: PlayerPosition;
  playedCards: Card[];
  playType: PlayTypeName;
  /** true = 违规出牌（无法压制或牌型非法），UI 显示红框警告 */
  isRuleViolation: boolean;
  /** 动作时间戳 */
  timestamp: number;
}

/** 桌面公共状态 */
export interface TableState {
  /** 当前打几（级牌点数） */
  currentLevelRank: Rank;
  /** 当前该出牌的玩家 */
  currentPlayer: PlayerPosition;
  /** 当前桌面的出牌堆（一轮的出牌记录） */
  actionHistory: PlayAction[];
}

/**
 * 用于时光机撤销/重做的完整游戏快照
 */
export interface GameSnapshot {
  snapshotId: string;
  timestamp: number;
  playersState: Record<PlayerPosition, Player>;
  tableState: TableState;
  /** 可选的备注（保存到云端时使用） */
  remark?: string;
}

/** 牌型识别结果 */
export interface PatternResult {
  type: PlayTypeName;
  /** 主特征值（用于同牌型比大小，炸弹取最小牌权重，顺子取最高牌权重等） */
  primaryValue: number;
  /** 牌的数量 */
  length: number;
  isValid: boolean;
}
