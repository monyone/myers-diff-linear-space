import { describe, it, expect } from 'vitest';
import weightedDiff, { type Operation } from '../src/weighted.mts';

const numDist = (a: number, b: number) => Math.abs(a - b);
const eqDist = (a: string, b: string) => a === b ? 0 : Infinity;

/**
 * ナイーブな重み付き edit distance (フル DP) をリファレンス実装として使用
 */
const naiveWeightedDiff = <T,>(
  from: T[],
  to: T[],
  cost: (a: T, b: T) => number,
): Operation[] => {
  const N = from.length;
  const M = to.length;

  // DP テーブル
  const dp: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(Infinity));
  dp[0][0] = 0;
  for (let i = 1; i <= N; i++) dp[i][0] = i;
  for (let j = 1; j <= M; j++) dp[0][j] = j;

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const match = dp[i - 1][j - 1] + cost(from[i - 1], to[j - 1]);
      const del = dp[i - 1][j] + 1;
      const ins = dp[i][j - 1] + 1;
      dp[i][j] = Math.min(match, del, ins);
    }
  }

  // backtrack
  const ops: Operation[] = [];
  let i = N, j = M;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const match = dp[i - 1][j - 1] + cost(from[i - 1], to[j - 1]);
      const del = dp[i - 1][j] + 1;
      const ins = dp[i][j - 1] + 1;
      const min = Math.min(match, del, ins);
      if (min === match && match === dp[i][j]) {
        // 対角移動 (match): 操作なし
        i--; j--;
        continue;
      }
      if (min === del && del === dp[i][j]) {
        ops.push({ type: 'delete', from: i - 1 });
        i--;
        continue;
      }
      // ins
      ops.push({ type: 'insert', to: j - 1 });
      j--;
    } else if (i > 0) {
      ops.push({ type: 'delete', from: i - 1 });
      i--;
    } else {
      ops.push({ type: 'insert', to: j - 1 });
      j--;
    }
  }
  ops.reverse();
  return ops;
};

/** 操作列から総コストを計算 */
const opsCost = <T,>(
  from: T[],
  to: T[],
  ops: Operation[],
  cost: (a: T, b: T) => number,
): number => {
  // ops に含まれない from/to のペアは match
  const deleted = new Set(ops.filter(o => o.type === 'delete').map(o => o.from));
  const inserted = new Set(ops.filter(o => o.type === 'insert').map(o => o.to));
  let total = deleted.size + inserted.size;

  // match ペアのコストを加算
  let fi = 0, ti = 0;
  while (fi < from.length && ti < to.length) {
    if (deleted.has(fi)) { fi++; continue; }
    if (inserted.has(ti)) { ti++; continue; }
    total += cost(from[fi], to[ti]);
    fi++; ti++;
  }
  return total;
};

describe('Weighted Diff (Hirschberg linear space)', () => {
  it('identical sequences', () => {
    const ops = weightedDiff([1, 2, 3], [1, 2, 3], numDist);
    expect(ops).toEqual([]);
  });

  it('completely different sequences', () => {
    const from = [1, 2, 3];
    const to = [4, 5, 6];
    const ops = weightedDiff(from, to, numDist);
    const ref = naiveWeightedDiff(from, to, numDist);
    expect(opsCost(from, to, ops, numDist)).toBeCloseTo(opsCost(from, to, ref, numDist), 8);
  });

  it('empty from', () => {
    const ops = weightedDiff([] as number[], [1, 2, 3], numDist);
    expect(ops).toEqual([
      { type: 'insert', to: 0 },
      { type: 'insert', to: 1 },
      { type: 'insert', to: 2 },
    ]);
  });

  it('empty to', () => {
    const ops = weightedDiff([1, 2, 3], [] as number[], numDist);
    expect(ops).toEqual([
      { type: 'delete', from: 0 },
      { type: 'delete', from: 1 },
      { type: 'delete', from: 2 },
    ]);
  });

  it('single element match', () => {
    const ops = weightedDiff([5], [5], numDist);
    expect(ops).toEqual([]);
  });

  it('single element mismatch (cost > 2)', () => {
    const ops = weightedDiff([0], [10], numDist);
    expect(ops).toEqual([
      { type: 'delete', from: 0 },
      { type: 'insert', to: 0 },
    ]);
  });

  it('single element mismatch (cost <= 2)', () => {
    const ops = weightedDiff([5], [6], numDist);
    // cost=1 <= 2, so match is cheaper than delete+insert
    expect(ops).toEqual([]);
  });

  it('insertion in the middle', () => {
    const ops = weightedDiff(['a', 'c'], ['a', 'b', 'c'], eqDist);
    expect(ops).toEqual([{ type: 'insert', to: 1 }]);
  });

  it('deletion in the middle', () => {
    const ops = weightedDiff(['a', 'b', 'c'], ['a', 'c'], eqDist);
    expect(ops).toEqual([{ type: 'delete', from: 1 }]);
  });

  it('matches naive implementation cost (equal length)', () => {
    const from = [1, 3, 5, 7, 9];
    const to = [2, 4, 6, 8, 10];
    const ops = weightedDiff(from, to, numDist);
    const ref = naiveWeightedDiff(from, to, numDist);
    expect(opsCost(from, to, ops, numDist)).toBeCloseTo(opsCost(from, to, ref, numDist), 8);
  });

  it('matches naive implementation cost (unequal length)', () => {
    const from = [1, 2, 3, 4, 5];
    const to = [1, 2, 2, 3, 4, 5, 5];
    const ops = weightedDiff(from, to, numDist);
    const ref = naiveWeightedDiff(from, to, numDist);
    expect(opsCost(from, to, ops, numDist)).toBeCloseTo(opsCost(from, to, ref, numDist), 8);
  });

  it('matches naive implementation cost (larger sequences)', () => {
    const from = Array.from({ length: 20 }, (_, i) => i);
    const to = Array.from({ length: 25 }, (_, i) => i + Math.sin(i) * 2);
    const ops = weightedDiff(from, to, numDist);
    const ref = naiveWeightedDiff(from, to, numDist);
    expect(opsCost(from, to, ops, numDist)).toBeCloseTo(opsCost(from, to, ref, numDist), 8);
  });

  it('string diff with exact match cost', () => {
    const from = ['hello', 'world', 'foo'];
    const to = ['hello', 'bar', 'world'];
    const ops = weightedDiff(from, to, eqDist);
    const ref = naiveWeightedDiff(from, to, eqDist);
    expect(opsCost(from, to, ops, eqDist)).toBe(opsCost(from, to, ref, eqDist));
  });

  it('operations are ordered by index', () => {
    const from = Array.from({ length: 10 }, (_, i) => i);
    const to = Array.from({ length: 10 }, (_, i) => i * 2);
    const ops = weightedDiff(from, to, numDist);

    // delete indices should be ascending
    const deletes = ops.filter(o => o.type === 'delete').map(o => o.from);
    for (let k = 1; k < deletes.length; k++) {
      expect(deletes[k]).toBeGreaterThan(deletes[k - 1]);
    }

    // insert indices should be ascending
    const inserts = ops.filter(o => o.type === 'insert').map(o => o.to);
    for (let k = 1; k < inserts.length; k++) {
      expect(inserts[k]).toBeGreaterThan(inserts[k - 1]);
    }
  });
});
