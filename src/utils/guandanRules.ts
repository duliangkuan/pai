/**
 * 掼蛋核心规则引擎
 * 纯函数 · 无副作用 · 严格类型
 *
 * 规则依据《竞技掼蛋竞赛规则》
 */
import { Card, OrganizedGroup, PatternResult, PlayTypeName, Rank, Suit } from '@/types/guandan';

// ============================================================
// § 0  理牌排序
// ============================================================

/**
 * 花色优先级（值越小越靠前，同权重时黑桃最优先）
 * 顺序：♠ > ♥ > ♣ > ♦
 */
const SUIT_PRIORITY: Record<Suit, number> = {
  Spades: 0,
  Hearts: 1,
  Clubs: 2,
  Diamonds: 3,
  Joker: -1, // Joker 权重由 value 决定，此处占位
};

/**
 * 自动理牌（纯函数，不修改原数组）。
 *
 * 排序规则（从左到右）：
 * 1. 逢人配（isWildcard=true）排最左侧
 * 2. 其余牌按动态权重**降序**（大王 > 小王 > 级牌 > A > … > 2）
 * 3. 同权重时按花色固定顺序（♠ > ♥ > ♣ > ♦）
 */
export function sortCards(cards: Card[], currentLevelRank: Rank): Card[] {
  return [...cards].sort((a, b) => {
    // 1. 逢人配始终排最前
    if (a.isWildcard !== b.isWildcard) {
      return a.isWildcard ? -1 : 1;
    }
    // 2. 按动态权重降序
    const va = getCardValue(a, currentLevelRank);
    const vb = getCardValue(b, currentLevelRank);
    if (va !== vb) return vb - va;
    // 3. 同权重按花色优先级升序（♠=0 排最左）
    return SUIT_PRIORITY[a.suit] - SUIT_PRIORITY[b.suit];
  });
}

/** 标准降序（不含王）：A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2 */
const STANDARD_DESC: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

/**
 * 根据当前级数返回单张大小顺序（从大到小）。
 * 规则：大王 > 小王 > 级牌 > 其余 12 张（标准降序剔除级牌）
 */
export function getRankOrderLargeToSmall(levelRank: Rank): Rank[] {
  if (levelRank === 'Small' || levelRank === 'Big') {
    return ['Big', 'Small', ...STANDARD_DESC];
  }
  const rest = STANDARD_DESC.filter((r) => r !== levelRank);
  return ['Big', 'Small', levelRank, ...rest];
}

/** 南北家：同数字一列，列从左到右=大到小，大王最左、小王次左 */
export function groupCardsByRankForNS(cards: Card[], levelRank: Rank): Card[][] {
  const groups: Partial<Record<Rank, Card[]>> = {};
  for (const card of cards) {
    if (!groups[card.rank]) groups[card.rank] = [];
    groups[card.rank]!.push(card);
  }
  for (const rank of Object.keys(groups) as Rank[]) {
    groups[rank]!.sort((a, b) => SUIT_PRIORITY[a.suit] - SUIT_PRIORITY[b.suit]);
  }
  const order = getRankOrderLargeToSmall(levelRank);
  return order.filter((r) => (groups[r]?.length ?? 0) > 0).map((r) => groups[r]!);
}

/** 西家/东家：同数字一行，行从下到上=小到大，大王最上、小王次上 */
export function groupCardsByRankForWE(cards: Card[], levelRank: Rank): Card[][] {
  const groups: Partial<Record<Rank, Card[]>> = {};
  for (const card of cards) {
    if (!groups[card.rank]) groups[card.rank] = [];
    groups[card.rank]!.push(card);
  }
  for (const rank of Object.keys(groups) as Rank[]) {
    groups[rank]!.sort((a, b) => SUIT_PRIORITY[a.suit] - SUIT_PRIORITY[b.suit]);
  }
  const order = [...getRankOrderLargeToSmall(levelRank)].reverse();
  return order.filter((r) => (groups[r]?.length ?? 0) > 0).map((r) => groups[r]!);
}

// ============================================================
// § 1  动态权值系统
// ============================================================

/** 所有点数的基础权重映射（大小王在此不用，直接返回 16/17） */
const BASE_RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  Small: 16, Big: 17,
};

/**
 * 逢人配选定 actingAs 后，在规则层面完全当作该牌处理。
 * 返回「用于规则计算的等效牌」：有 actingAs 则用其 suit/rank，否则原样。
 */
function resolveCardForRules(card: Card): Card {
  if (card.actingAs) {
    return { ...card, suit: card.actingAs.suit, rank: card.actingAs.rank, isWildcard: false };
  }
  return card;
}

/**
 * 计算一张牌在当前局面下的动态权重。
 *
 * 权重从小到大：
 *   普通牌 (2~A) < 非红桃级牌 (value=15) < 小王 (16) < 大王 (17)
 *   逢人配（红桃级牌）作百搭使用时权重由场景决定，此处返回 15。
 *   逢人配已指定 actingAs 时，按 actingAs 的 rank 计算。
 */
export function getCardValue(card: Card, currentLevelRank: Rank): number {
  const rank = card.actingAs ? card.actingAs.rank : card.rank;
  const suit = card.actingAs ? card.actingAs.suit : card.suit;
  if (suit === 'Joker') {
    return rank === 'Big' ? 17 : 16;
  }
  if (rank === currentLevelRank) {
    return 15;
  }
  return BASE_RANK_VALUE[rank];
}

// ============================================================
// § 2  内部工具函数
// ============================================================

/** 将点数字符串转换为"自然大小"整数（A=14，用于连续性判断） */
function rankToInt(rank: Rank): number {
  return BASE_RANK_VALUE[rank] ?? 0;
}

/** 对牌组按动态权重升序排序（返回新数组，不修改原数组） */
function sortByValue(cards: Card[], levelRank: Rank): Card[] {
  return [...cards].sort((a, b) => getCardValue(a, levelRank) - getCardValue(b, levelRank));
}

/** 将牌组分为「逢人配」和「非逢人配」两组。已指定 actingAs 的逢人配视为普通牌。 */
function splitWildcards(cards: Card[]): { wilds: Card[]; nonWilds: Card[] } {
  const wilds: Card[] = [];
  const nonWilds: Card[] = [];
  for (const c of cards) {
    if (c.isWildcard && !c.actingAs) wilds.push(c);
    else nonWilds.push(c.actingAs ? resolveCardForRules(c) : c);
  }
  return { wilds, nonWilds };
}

/** 统计每个权重值出现次数 */
function countByValue(cards: Card[], levelRank: Rank): Map<number, Card[]> {
  const map = new Map<number, Card[]>();
  for (const c of cards) {
    const v = getCardValue(c, levelRank);
    const arr = map.get(v) ?? [];
    arr.push(c);
    map.set(v, arr);
  }
  return map;
}

// ============================================================
// § 3  牌型识别辅助：用填坑法处理逢人配
// ============================================================

/**
 * 顺子/同花顺合法性校验（含逢人配填坑）。
 * @param nonWilds  非百搭牌（已去重检查）
 * @param wildcardCount  可用逢人配数量
 * @param requiredLen   要求长度（通常5）
 * @param levelRank     当前打几
 * @param requireSameFlush 是否要求同花（同花顺）
 * @returns { ok, highValue } ok=true 时 highValue 为顺子最高牌自然值
 */
function checkStraightLike(
  nonWilds: Card[],
  wildcardCount: number,
  requiredLen: number,
  levelRank: Rank,
  requireSameFlush: boolean
): { ok: boolean; highValue: number } {
  const FAIL = { ok: false, highValue: 0 };

  // 同花检查
  if (requireSameFlush) {
    const suits = new Set(nonWilds.map((c) => c.suit));
    if (suits.size > 1) return FAIL;
  }

  // 过滤掉级牌（级牌不能作为顺子组成牌，除非作逢人配替代）
  // 注意：nonWilds 里不含逢人配（红桃级牌），但可能含非红桃级牌
  // 非红桃级牌 value=15，超出 A(14) 范围，不可入顺子
  const eligible = nonWilds.filter((c) => {
    const v = getCardValue(c, levelRank);
    // 只允许 A(14) 及以下的普通权重牌入顺
    return v <= 14;
  });

  if (eligible.length + wildcardCount < requiredLen) return FAIL;
  if (eligible.length > requiredLen) return FAIL;

  // 取自然值（A=14）
  const vals = eligible.map((c) => rankToInt(c.rank));
  const uniqueVals = [...new Set(vals)].sort((a, b) => a - b);

  // 有重复点数（非百搭组成）→ 非法
  if (uniqueVals.length !== eligible.length) return FAIL;

  const n = requiredLen;
  const wildcards = wildcardCount;

  // 尝试用当前非百搭牌集合和逢人配填出合法连续段
  // 枚举顺子最低点（允许 A=1 的特殊情况 A2345）

  // 掼蛋允许顺子：A2345(A当1=1) ~ 10JQKA(10~14)
  // 注意不允许跨越 A-2（即 JQKA2 等非法）
  // A 既可当 1（只在最低顺 A2345），也可当 14（在 10JQKA）

  // 构造候选连续区间 [lo, lo+n-1]
  // lo 范围：1 ~ (14-n+1)，其中 lo=1 代表 A2345
  for (let lo = 1; lo <= 14 - n + 1; lo++) {
    const hi = lo + n - 1;
    // 将 A 特殊处理：自然值14，在 A2345 中视作 1
    const segment: number[] = [];
    for (let v = lo; v <= hi; v++) {
      segment.push(v);
    }

    // 计算需要逢人配填补的空缺
    let gaps = 0;
    for (const sv of segment) {
      // A2345 中 1 对应 A(14)
      const naturalVal = lo === 1 && sv === 1 ? 14 : sv;
      if (!uniqueVals.includes(naturalVal)) gaps++;
    }

    if (gaps <= wildcards) {
      // 找到合法顺子，高值 = hi（若是 A2345，最高实际牌 = 5）
      const highValue = lo === 1 ? 5 : hi;
      return { ok: true, highValue };
    }
  }

  return FAIL;
}

/**
 * 三连对（Tube）/ 钢板（Plate）合法性校验
 * @param pairCount   需要几「对」（Tube=3，Plate=2，但每组3张）
 * @param groupSize  每组几张（Pair-like=2, Triple-like=3）
 */
function checkConsecutiveGroups(
  nonWilds: Card[],
  wildcardCount: number,
  groupCount: number,
  groupSize: number,
  levelRank: Rank
): { ok: boolean; highValue: number } {
  const FAIL = { ok: false, highValue: 0 };
  const totalNeeded = groupCount * groupSize;
  if (nonWilds.length + wildcardCount !== totalNeeded) return FAIL;

  // 统计非百搭各值出现次数
  const countMap = countByValue(nonWilds, levelRank);

  // 过滤掉超出 14 的级牌（不能入连牌）
  for (const [v] of countMap) {
    if (v > 14) return FAIL;
  }

  // 各值出现次数不能超过 groupSize
  for (const [, cards] of countMap) {
    if (cards.length > groupSize) return FAIL;
  }

  // 枚举连续区间 [lo, lo+groupCount-1]
  for (let lo = 2; lo <= 14 - groupCount + 1; lo++) {
    const segment: number[] = [];
    for (let v = lo; v < lo + groupCount; v++) segment.push(v);

    // 需要填的空位（每个点位需要 groupSize 张，缺口由百搭补）
    let wildcardNeeded = 0;
    for (const sv of segment) {
      const have = countMap.get(sv)?.length ?? 0;
      if (have > groupSize) { wildcardNeeded = Infinity; break; }
      wildcardNeeded += groupSize - have;
    }

    if (wildcardNeeded <= wildcardCount) {
      return { ok: true, highValue: lo + groupCount - 1 };
    }
  }
  return FAIL;
}

// ============================================================
// § 4  主牌型识别器
// ============================================================

/** 无效结果快速构造 */
const INVALID: PatternResult = {
  type: 'Invalid',
  primaryValue: 0,
  length: 0,
  isValid: false,
};

/**
 * 识别一组牌的牌型。
 * 支持：单张、对子、三同张、三带二、顺子、同花顺、三连对、钢板、炸弹、四大天王。
 * 逢人配已指定 actingAs 时，在合法性校验中完全当作该牌处理。
 */
export function identifyPattern(cards: Card[], currentLevelRank: Rank): PatternResult {
  const n = cards.length;
  if (n === 0) return INVALID;

  const resolvedCards = cards.map(resolveCardForRules);
  const { wilds, nonWilds } = splitWildcards(resolvedCards);
  const wc = wilds.length;

  // ── 四大天王：必须恰好 2 大王 + 2 小王 ───────────────────
  if (n === 4) {
    const bigs = cards.filter((c) => c.rank === 'Big').length;
    const smalls = cards.filter((c) => c.rank === 'Small').length;
    if (bigs === 2 && smalls === 2) {
      return { type: 'KingBomb', primaryValue: 100, length: 4, isValid: true };
    }
  }

  // ── 炸弹：4 张及以上同点数（可含逢人配） ─────────────────
  if (n >= 4) {
    const valueMap = countByValue(nonWilds, currentLevelRank);
    // 非百搭只能有一种点数
    if (valueMap.size <= 1 && !nonWilds.some((c) => c.suit === 'Joker')) {
      // 所有非百搭必须同值，且非王牌（大小王不组普通炸弹）
      const hasJokerInNonWild = nonWilds.some((c) => c.suit === 'Joker');
      if (!hasJokerInNonWild) {
        if (valueMap.size === 0) {
          // 全是逢人配，不认定为炸弹（规则：逢人配不能单独成炸弹）
        } else {
          const [[bv, bCards]] = [...valueMap.entries()];
          if (bCards.length + wc === n) {
            return { type: 'Bomb', primaryValue: bv, length: n, isValid: true };
          }
        }
      }
    }
  }

  // ── 单张 ─────────────────────────────────────────────────
  if (n === 1) {
    const v = getCardValue(cards[0], currentLevelRank);
    return { type: 'Single', primaryValue: v, length: 1, isValid: true };
  }

  // ── 大小王纯组合（非四大天王）→ 不合法 ───────────────────
  if (nonWilds.every((c) => c.suit === 'Joker') && wc === 0) {
    if (cards.every((c) => c.suit === 'Joker')) return INVALID;
  }

  // ── 对子 ─────────────────────────────────────────────────
  if (n === 2) {
    // 双王不是对子
    if (cards.every((c) => c.suit === 'Joker')) return INVALID;
    // 逢人配 + 任意非王牌 → 合法对子
    if (wc === 1 && nonWilds.length === 1 && nonWilds[0].suit !== 'Joker') {
      const v = getCardValue(nonWilds[0], currentLevelRank);
      return { type: 'Pair', primaryValue: v, length: 2, isValid: true };
    }
    // 普通对子：同点数
    if (wc === 0) {
      const v0 = getCardValue(cards[0], currentLevelRank);
      const v1 = getCardValue(cards[1], currentLevelRank);
      if (v0 === v1 && cards[0].suit !== 'Joker') {
        return { type: 'Pair', primaryValue: v0, length: 2, isValid: true };
      }
    }
    return INVALID;
  }

  // ── 三同张 ───────────────────────────────────────────────
  if (n === 3) {
    if (cards.some((c) => c.suit === 'Joker')) return INVALID;
    const vals = new Set(nonWilds.map((c) => getCardValue(c, currentLevelRank)));
    if (vals.size === 1) {
      const v = [...vals][0];
      if (nonWilds.length + wc === 3) {
        return { type: 'Triple', primaryValue: v, length: 3, isValid: true };
      }
    }
    // 逢人配 + 一种点数
    if (wc > 0 && vals.size === 1) {
      const v = [...vals][0];
      return { type: 'Triple', primaryValue: v, length: 3, isValid: true };
    }
    return INVALID;
  }

  // ── 三带二 (5张) ─────────────────────────────────────────
  if (n === 5) {
    // 先尝试同花顺（同花顺也是顺子，必须先识别更具体的牌型，否则会误判为普通顺子进非炸弹区）
    const { ok: sfOk, highValue: sfHigh } = checkStraightLike(
      nonWilds, wc, 5, currentLevelRank, true
    );
    if (sfOk) {
      return { type: 'StraightFlush', primaryValue: sfHigh, length: 5, isValid: true };
    }
    // 再尝试普通顺子
    const { ok: straightOk, highValue: sHigh } = checkStraightLike(
      nonWilds, wc, 5, currentLevelRank, false
    );
    if (straightOk) {
      return { type: 'Straight', primaryValue: sHigh, length: 5, isValid: true };
    }
    // 三带二：找到 3张同值 + 2张同值（可含百搭）
    if (!cards.some((c) => c.suit === 'Joker' && !c.isWildcard)) {
      const res = tryTripleWithPair(nonWilds, wc, currentLevelRank);
      if (res.isValid) return res;
    }
    return INVALID;
  }

  // ── 三连对 (6张) ─────────────────────────────────────────
  if (n === 6) {
    // 先试钢板（2 × 三同张连续）
    const plateRes = checkConsecutiveGroups(nonWilds, wc, 2, 3, currentLevelRank);
    if (plateRes.ok) {
      return { type: 'Plate', primaryValue: plateRes.highValue, length: 6, isValid: true };
    }
    // 再试三连对（3 × 对子连续）
    const tubeRes = checkConsecutiveGroups(nonWilds, wc, 3, 2, currentLevelRank);
    if (tubeRes.ok) {
      return { type: 'Tube', primaryValue: tubeRes.highValue, length: 6, isValid: true };
    }
    // 6张炸弹
    const vals6 = new Set(nonWilds.map((c) => getCardValue(c, currentLevelRank)));
    if (vals6.size <= 1 && nonWilds.every((c) => c.suit !== 'Joker')) {
      const v = vals6.size === 1 ? [...vals6][0] : 0;
      if (v > 0) {
        return { type: 'Bomb', primaryValue: v, length: 6, isValid: true };
      }
    }
    return INVALID;
  }

  // ── 更长牌型（7张以上）─────────────────────────────────
  // 炸弹已在最前面处理；顺子只能是五张连续单牌，不支持长顺子

  return INVALID;
}

// ── 三带二 内部辅助 ────────────────────────────────────────

/**
 * 尝试在 5 张牌（含百搭）中识别三带二。
 * 返回 PatternResult，type='TripleWithPair' 或 Invalid。
 */
function tryTripleWithPair(
  nonWilds: Card[],
  wildcardCount: number,
  levelRank: Rank
): PatternResult {
  // 非百搭牌按值分组
  const grouped = countByValue(nonWilds, levelRank);
  // 不允许含王牌
  for (const [v] of grouped) {
    if (v >= 16) return INVALID;
  }

  // 枚举「三同张点值」和「对子点值」的所有组合
  const vals = [...grouped.keys()];
  // 加上 wildcards 作为虚拟点值（用 -1 标记）

  // 全排列穷举：n ≤ 2 个不同点值 + wildcards 填坑
  // 三同张需 3 张相同 → 可用 wildcards 补；对子同理
  for (const tripleVal of vals) {
    const tripleHave = grouped.get(tripleVal)?.length ?? 0;
    const tripleNeed = 3 - tripleHave;
    if (tripleNeed < 0 || tripleNeed > wildcardCount) continue;

    const remainingWilds = wildcardCount - tripleNeed;
    // 对子候选
    const pairCandidates = vals.filter((v) => v !== tripleVal);
    // 也可能全靠 wildcards 组成对子
    if (pairCandidates.length === 0 && remainingWilds >= 2) {
      // 对子全靠百搭（百搭+百搭视为同类）
      return {
        type: 'TripleWithPair',
        primaryValue: tripleVal,
        length: 5,
        isValid: true,
      };
    }
    for (const pairVal of pairCandidates) {
      const pairHave = grouped.get(pairVal)?.length ?? 0;
      // 其余非三同张点值必须恰好组成对子
      const otherVals = pairCandidates.filter((v) => v !== pairVal);
      const otherCount = otherVals.reduce(
        (acc, v) => acc + (grouped.get(v)?.length ?? 0),
        0
      );
      if (otherCount > 0) continue; // 有多余点值
      const pairNeed = 2 - pairHave;
      if (pairNeed < 0 || pairNeed > remainingWilds) continue;
      return {
        type: 'TripleWithPair',
        primaryValue: tripleVal,
        length: 5,
        isValid: true,
      };
    }
  }
  return INVALID;
}

// ============================================================
// § 5  比大小与压制逻辑
// ============================================================

/**
 * 判断牌型是否为炸弹类（Bomb/StraightFlush/KingBomb）
 */
export function isBombType(pattern: PatternResult): boolean {
  return pattern.type === 'Bomb' || pattern.type === 'StraightFlush' || pattern.type === 'KingBomb';
}

/**
 * 计算牌型的"炸弹等级"（用于理牌区排序）：
 *   四大天王=7, 8+张炸=6, 7张炸=5, 6张炸=4, 同花顺=3, 5张炸=2, 4张炸=1, 非炸=0
 */
export function getBombRank(pattern: PatternResult): number {
  if (pattern.type === 'KingBomb') return 7;
  if (pattern.type === 'StraightFlush') return 3;
  if (pattern.type === 'Bomb') {
    if (pattern.length >= 8) return 6;
    if (pattern.length === 7) return 5;
    if (pattern.length === 6) return 4;
    if (pattern.length === 5) return 2;
    return 1; // 4张
  }
  return 0;
}

/**
 * 判断 newPattern 是否能压制 oldPattern。
 *
 * 规则：
 * 1. 同牌型（含同级炸弹）→ 比 primaryValue
 * 2. 炸弹可以压制非炸弹，大炸弹压小炸弹（按 bombRank）
 * 3. 非炸弹之间必须同牌型且同长度才能比较
 */
export function canBeat(
  newPattern: PatternResult,
  oldPattern: PatternResult
): boolean {
  if (!newPattern.isValid || !oldPattern.isValid) return false;
  if (oldPattern.type === 'Pass') return true;

  const newBR = getBombRank(newPattern);
  const oldBR = getBombRank(oldPattern);

  // 都是炸弹类型（含同花顺）
  if (newBR > 0 && oldBR > 0) {
    if (newBR !== oldBR) return newBR > oldBR;
    // 同级炸弹比 primaryValue，再比长度
    if (newPattern.length !== oldPattern.length) return newPattern.length > oldPattern.length;
    return newPattern.primaryValue > oldPattern.primaryValue;
  }

  // 新出炸弹，旧出非炸弹
  if (newBR > 0 && oldBR === 0) return true;

  // 新出非炸弹，旧出炸弹
  if (newBR === 0 && oldBR > 0) return false;

  // 都是非炸弹：必须同牌型且同长度
  if (newPattern.type !== oldPattern.type) return false;
  if (newPattern.length !== oldPattern.length) return false;
  return newPattern.primaryValue > oldPattern.primaryValue;
}

/**
 * 理牌区排序：从大到小。
 * 炸弹：先按 bombRank，再按 primaryValue，再按 length。
 * 非炸弹：按 primaryValue 降序。
 */
export function sortOrganizedGroups(groups: OrganizedGroup[]): OrganizedGroup[] {
  return [...groups].sort((a, b) => {
    if (a.isBomb !== b.isBomb) return a.isBomb ? -1 : 1; // 炸弹在前（同区内不会混）
    const patternA: PatternResult = { type: a.type, primaryValue: a.primaryValue, length: a.length, isValid: true };
    const patternB: PatternResult = { type: b.type, primaryValue: b.primaryValue, length: b.length, isValid: true };
    const rA = getBombRank(patternA);
    const rB = getBombRank(patternB);
    if (rA !== rB) return rB - rA; // 炸弹等级高的在前
    if (a.primaryValue !== b.primaryValue) return b.primaryValue - a.primaryValue;
    return b.length - a.length;
  });
}

// ============================================================
// § 6  逢人配合法解析枚举
// ============================================================

export interface WildcardSuggestion {
  suit: Suit;
  rank: Rank;
  displayLabel: string;
}

const SUIT_SYMBOL_WILD: Record<Suit, string> = {
  Spades: '♠', Hearts: '♥', Clubs: '♣', Diamonds: '♦', Joker: '',
};

/**
 * 给定包含逢人配的已选牌组，枚举所有可选的「逢人配替代方案」。
 * 不做合法性校验，直接返回除红桃级牌外的全部花色+点数组合。
 */
export function enumerateWildcardOptions(
  cards: Card[],
  currentLevelRank: Rank
): WildcardSuggestion[] {
  const SUITS_NORMAL: Suit[] = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
  const RANKS_NORMAL: Rank[] = [
    '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
  ];

  const wildcards = cards.filter((c) => c.isWildcard);
  if (wildcards.length === 0) return [];

  const suggestions: WildcardSuggestion[] = [];
  for (const suit of SUITS_NORMAL) {
    for (const rank of RANKS_NORMAL) {
      if (rank === currentLevelRank && suit === 'Hearts') continue; // 不替代自身
      suggestions.push({
        suit,
        rank,
        displayLabel: `${SUIT_SYMBOL_WILD[suit]}${rank}`,
      });
    }
  }
  return suggestions;
}
