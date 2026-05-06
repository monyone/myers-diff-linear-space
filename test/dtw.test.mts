import { describe, it, expect } from 'vitest';
import dtw from '../src/naive-dtw.mts';

type Alignment = [number, number];

const numDist = (a: number, b: number) => Math.abs(a - b);

/**
 * ナイーブな DTW (フル DP) をリファレンス実装として使用
 */
const naiveDTW = <T,>(
  from: T[],
  to: T[],
  dist: (a: T, b: T) => number = (a, b) => Math.abs(Number(a) - Number(b))
): { path: Alignment[]; distance: number } => {
  const N = from.length;
  const M = to.length;

  const cost: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(Infinity));
  cost[0][0] = 0;

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const d = dist(from[i - 1], to[j - 1]);
      cost[i][j] = d + Math.min(cost[i - 1][j - 1], cost[i - 1][j], cost[i][j - 1]);
    }
  }

  // バックトレースで経路を復元
  const path: Alignment[] = [];
  let i = N, j = M;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const diag = cost[i - 1][j - 1];
    const up = cost[i - 1][j];
    const left = cost[i][j - 1];
    const min = Math.min(diag, up, left);
    if (min === diag) { i--; j--; }
    else if (min === up) { i--; }
    else { j--; }
  }
  path.reverse();

  return { path, distance: cost[N][M] };
};

const totalDistance = <T,>(
  from: T[],
  to: T[],
  path: Alignment[],
  dist: (a: T, b: T) => number = (a, b) => Math.abs(Number(a) - Number(b))
): number => {
  return path.reduce((sum, [i, j]) => sum + dist(from[i], to[j]), 0);
};

describe('DTW with Sakoe-Chiba Band (linear space)', () => {
  it('identical sequences', () => {
    const path = dtw([1, 2, 3], [1, 2, 3], numDist, 2);
    expect(path).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it('single element each', () => {
    const path = dtw([5], [5], numDist, 1);
    expect(path).toEqual([[0, 0]]);
  });

  it('single from, multiple to', () => {
    const path = dtw([3], [1, 2, 3, 4, 5], numDist, 3);
    expect(path.length).toBe(5);
    expect(path.every(([i]) => i === 0)).toBe(true);
    expect(path.map(([, j]) => j)).toEqual([0, 1, 2, 3, 4]);
  });

  it('multiple from, single to', () => {
    const path = dtw([1, 2, 3], [5], numDist, 3);
    expect(path.length).toBe(3);
    expect(path.every(([, j]) => j === 0)).toBe(true);
    expect(path.map(([i]) => i)).toEqual([0, 1, 2]);
  });

  it('monotonicity', () => {
    const path = dtw([1, 2, 3, 4, 5], [1, 2, 2, 3, 4, 5], numDist, 3);
    for (let k = 1; k < path.length; k++) {
      expect(path[k][0]).toBeGreaterThanOrEqual(path[k - 1][0]);
      expect(path[k][1]).toBeGreaterThanOrEqual(path[k - 1][1]);
    }
  });

  it('boundary coverage', () => {
    const from = [0, 1, 2, 3, 4];
    const to = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
    const path = dtw(from, to, numDist, 5);
    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([from.length - 1, to.length - 1]);
  });

  it('full coverage of both sequences', () => {
    const from = Array.from({ length: 30 }, (_, i) => Math.sin(i * 0.3));
    const to = Array.from({ length: 40 }, (_, i) => Math.sin(i * 0.3) + 0.01);
    const path = dtw(from, to, numDist, 10);

    const fromIndices = new Set(path.map(([i]) => i));
    const toIndices = new Set(path.map(([, j]) => j));
    expect(fromIndices.size).toBe(from.length);
    expect(toIndices.size).toBe(to.length);
  });

  it('matches naive DTW cost (equal length)', () => {
    const from = [1, 3, 5, 7, 9];
    const to = [2, 4, 6, 8, 10];
    const bw = 5; // band >= length なので制約なし

    const path = dtw(from, to, numDist, bw);
    const ref = naiveDTW(from, to);
    expect(totalDistance(from, to, path)).toBe(ref.distance);
  });

  it('matches naive DTW cost (unequal length)', () => {
    const from = [1, 2, 3, 4, 5];
    const to = [1, 2, 2, 3, 4, 5, 5];
    const bw = 7;

    const path = dtw(from, to, numDist, bw);
    const ref = naiveDTW(from, to);
    expect(totalDistance(from, to, path)).toBe(ref.distance);
  });

  it('matches naive DTW cost (larger sequences)', () => {
    const from = Array.from({ length: 20 }, (_, i) => i);
    const to = Array.from({ length: 25 }, (_, i) => i + Math.sin(i) * 2);
    const bw = 25;

    const path = dtw(from, to, numDist, bw);
    const ref = naiveDTW(from, to);
    expect(totalDistance(from, to, path)).toBeCloseTo(ref.distance, 8);
  });

  it('custom distance function', () => {
    const from = ['hello', 'world', 'foo'];
    const to = ['hello', 'bar', 'world'];
    const strDist = (a: string, b: string) => a === b ? 0 : 1;
    const path = dtw(from, to, strDist, 3);

    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([2, 2]);
    expect(totalDistance(from, to, path, strDist)).toBeLessThanOrEqual(
      from.length + to.length
    );
  });

  it('time-warped sinusoid', () => {
    const from = Array.from({ length: 50 }, (_, i) => Math.sin(i * 0.1));
    const to = Array.from({ length: 50 }, (_, i) => Math.sin(i * 0.12));
    const path = dtw(from, to, numDist, 10);

    // 単調性
    for (let k = 1; k < path.length; k++) {
      expect(path[k][0]).toBeGreaterThanOrEqual(path[k - 1][0]);
      expect(path[k][1]).toBeGreaterThanOrEqual(path[k - 1][1]);
    }
    // 境界
    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([49, 49]);
  });

  it('narrow band still produces valid path', () => {
    const from = [1, 2, 3, 4, 5];
    const to = [1, 2, 3, 4, 5];
    const path = dtw(from, to, numDist, 1);

    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([4, 4]);
    for (let k = 1; k < path.length; k++) {
      expect(path[k][0]).toBeGreaterThanOrEqual(path[k - 1][0]);
      expect(path[k][1]).toBeGreaterThanOrEqual(path[k - 1][1]);
    }
  });

  it('wide band matches unconstrained DTW', () => {
    const from = [3, 1, 4, 1, 5, 9, 2, 6];
    const to = [2, 7, 1, 8, 2, 8, 1, 8];
    const bw = Math.max(from.length, to.length);

    const path = dtw(from, to, numDist, bw);
    const ref = naiveDTW(from, to);
    expect(totalDistance(from, to, path)).toBe(ref.distance);
  });

  it('step constraint (no skipping)', () => {
    const from = [0, 1, 2, 3];
    const to = [0, 1, 2, 3, 4, 5];
    const path = dtw(from, to, numDist, 4);

    for (let k = 1; k < path.length; k++) {
      const di = path[k][0] - path[k - 1][0];
      const dj = path[k][1] - path[k - 1][1];
      // 各ステップは (0,1), (1,0), (1,1) のいずれか
      expect(di).toBeGreaterThanOrEqual(0);
      expect(di).toBeLessThanOrEqual(1);
      expect(dj).toBeGreaterThanOrEqual(0);
      expect(dj).toBeLessThanOrEqual(1);
      expect(di + dj).toBeGreaterThanOrEqual(1);
    }
  });
});
