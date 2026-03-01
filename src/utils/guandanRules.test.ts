/**
 * 掼蛋规则引擎单元测试
 */
import { describe, expect, it } from 'vitest';
import {
  sortCards,
  getRankOrderLargeToSmall,
  getCardValue,
  identifyPattern,
  canBeat,
  getBombRank,
  isBombType,
  groupCardsByRankForNS,
  groupCardsByRankForWE,
} from './guandanRules';
import type { Card, PatternResult } from '@/types/guandan';

/** 创建测试用牌 */
function card(id: string, suit: string, rank: string, isWildcard = false, actingAs?: { suit: string; rank: string }): Card {
  return {
    id,
    suit: suit as Card['suit'],
    rank: rank as Card['rank'],
    value: 0,
    isWildcard,
    actingAs: actingAs as Card['actingAs'],
  };
}

describe('getRankOrderLargeToSmall', () => {
  it('打2时级牌2排在大王小王之后', () => {
    const order = getRankOrderLargeToSmall('2');
    expect(order[0]).toBe('Big');
    expect(order[1]).toBe('Small');
    expect(order[2]).toBe('2');
  });

  it('打A时级牌A在正确位置', () => {
    const order = getRankOrderLargeToSmall('A');
    expect(order.slice(0, 3)).toEqual(['Big', 'Small', 'A']);
  });
});

describe('getCardValue', () => {
  it('大王权重17，小王16', () => {
    const big = card('b', 'Joker', 'Big');
    const small = card('s', 'Joker', 'Small');
    expect(getCardValue(big, '2')).toBe(17);
    expect(getCardValue(small, '2')).toBe(16);
  });

  it('打2时级牌2权重15', () => {
    const level2 = card('c', 'Spades', '2');
    expect(getCardValue(level2, '2')).toBe(15);
  });

  it('A权重14', () => {
    const ace = card('a', 'Hearts', 'A');
    expect(getCardValue(ace, '2')).toBe(14);
  });
});

describe('sortCards', () => {
  it('逢人配排最前', () => {
    const cards = [
      card('1', 'Spades', 'A'),
      card('2', 'Hearts', '2', true),
      card('3', 'Clubs', 'K'),
    ];
    const sorted = sortCards(cards, '2');
    expect(sorted[0].isWildcard).toBe(true);
  });

  it('按权重降序排列', () => {
    const cards = [
      card('1', 'Spades', '3'),
      card('2', 'Hearts', 'A'),
      card('3', 'Clubs', '7'),
    ];
    const sorted = sortCards(cards, '2');
    expect(sorted[0].rank).toBe('A');
    expect(sorted[1].rank).toBe('7');
    expect(sorted[2].rank).toBe('3');
  });
});

describe('identifyPattern', () => {
  it('单张合法', () => {
    const c = [card('1', 'Spades', '5')];
    const r = identifyPattern(c, '2');
    expect(r.isValid).toBe(true);
    expect(r.type).toBe('Single');
  });

  it('对子合法', () => {
    const c = [
      card('1', 'Spades', '5'),
      card('2', 'Hearts', '5'),
    ];
    const r = identifyPattern(c, '2');
    expect(r.isValid).toBe(true);
    expect(r.type).toBe('Pair');
  });

  it('三同张合法', () => {
    const c = [
      card('1', 'Spades', '7'),
      card('2', 'Hearts', '7'),
      card('3', 'Clubs', '7'),
    ];
    const r = identifyPattern(c, '2');
    expect(r.isValid).toBe(true);
    expect(r.type).toBe('Triple');
  });

  it('四大天王', () => {
    const c = [
      card('1', 'Joker', 'Big'),
      card('2', 'Joker', 'Big'),
      card('3', 'Joker', 'Small'),
      card('4', 'Joker', 'Small'),
    ];
    const r = identifyPattern(c, '2');
    expect(r.isValid).toBe(true);
    expect(r.type).toBe('KingBomb');
  });

  it('4张同点炸弹', () => {
    const c = [
      card('1', 'Spades', '8'),
      card('2', 'Hearts', '8'),
      card('3', 'Clubs', '8'),
      card('4', 'Diamonds', '8'),
    ];
    const r = identifyPattern(c, '2');
    expect(r.isValid).toBe(true);
    expect(r.type).toBe('Bomb');
  });

  it('无效牌型返回 Invalid', () => {
    const c = [
      card('1', 'Spades', '5'),
      card('2', 'Hearts', '7'),
    ];
    const r = identifyPattern(c, '2');
    expect(r.isValid).toBe(false);
    expect(r.type).toBe('Invalid');
  });
});

describe('canBeat', () => {
  it('同牌型对子比大小', () => {
    const small: PatternResult = { type: 'Pair', primaryValue: 5, length: 2, isValid: true };
    const large: PatternResult = { type: 'Pair', primaryValue: 10, length: 2, isValid: true };
    expect(canBeat(large, small)).toBe(true);
    expect(canBeat(small, large)).toBe(false);
  });

  it('炸弹压非炸弹', () => {
    const bomb: PatternResult = { type: 'Bomb', primaryValue: 10, length: 4, isValid: true };
    const pair: PatternResult = { type: 'Pair', primaryValue: 14, length: 2, isValid: true };
    expect(canBeat(bomb, pair)).toBe(true);
    expect(canBeat(pair, bomb)).toBe(false);
  });

  it('四大天王最大', () => {
    const king: PatternResult = { type: 'KingBomb', primaryValue: 100, length: 4, isValid: true };
    const bomb: PatternResult = { type: 'Bomb', primaryValue: 14, length: 6, isValid: true };
    expect(canBeat(king, bomb)).toBe(true);
  });
});

describe('getBombRank', () => {
  it('四大天王=7', () => {
    const p: PatternResult = { type: 'KingBomb', primaryValue: 100, length: 4, isValid: true };
    expect(getBombRank(p)).toBe(7);
  });

  it('同花顺=3', () => {
    const p: PatternResult = { type: 'StraightFlush', primaryValue: 14, length: 5, isValid: true };
    expect(getBombRank(p)).toBe(3);
  });

  it('4张炸=1', () => {
    const p: PatternResult = { type: 'Bomb', primaryValue: 10, length: 4, isValid: true };
    expect(getBombRank(p)).toBe(1);
  });

  it('非炸弹=0', () => {
    const p: PatternResult = { type: 'Pair', primaryValue: 10, length: 2, isValid: true };
    expect(getBombRank(p)).toBe(0);
  });
});

describe('isBombType', () => {
  it('Bomb/StraightFlush/KingBomb 为炸弹', () => {
    expect(isBombType({ type: 'Bomb', primaryValue: 10, length: 4, isValid: true })).toBe(true);
    expect(isBombType({ type: 'StraightFlush', primaryValue: 14, length: 5, isValid: true })).toBe(true);
    expect(isBombType({ type: 'KingBomb', primaryValue: 100, length: 4, isValid: true })).toBe(true);
  });

  it('对子非炸弹', () => {
    expect(isBombType({ type: 'Pair', primaryValue: 10, length: 2, isValid: true })).toBe(false);
  });
});

describe('groupCardsByRankForNS', () => {
  it('按点数分组且顺序正确', () => {
    const cards = [
      card('1', 'Spades', 'A'),
      card('2', 'Hearts', '5'),
      card('3', 'Clubs', 'A'),
    ];
    const groups = groupCardsByRankForNS(cards, '2');
    expect(groups.length).toBe(2);
    expect(groups[0].every((c) => c.rank === 'A')).toBe(true);
    expect(groups[1].every((c) => c.rank === '5')).toBe(true);
  });
});

describe('groupCardsByRankForWE', () => {
  it('按点数分组顺序与NS相反', () => {
    const cards = [
      card('1', 'Spades', 'A'),
      card('2', 'Hearts', '5'),
    ];
    const groups = groupCardsByRankForWE(cards, '2');
    expect(groups.length).toBe(2);
    expect(groups[0].every((c) => c.rank === '5')).toBe(true);
    expect(groups[1].every((c) => c.rank === 'A')).toBe(true);
  });
});
