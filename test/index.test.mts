import { describe, it, expect } from 'vitest';
import diff from '../src/index.mts';
import type { Operation } from '../src/index.mts';

const apply = <T,>(from: T[], to: T[], ops: Operation[]): T[] => {
  const delete_ops = new Set(ops.filter((o) => o.type === 'delete').map((o) => o.from));
  const insert_ops = new Set(ops.filter((o) => o.type === 'insert').map((o) => o.to));

  const rebuilt: T[] = [];
  let from_current_pos = 0;
  let to_current_pos = 0;

  while (from_current_pos < from.length || to_current_pos < to.length) {
    if (delete_ops.has(from_current_pos)) {
      from_current_pos++;
    } else if (insert_ops.has(to_current_pos)) {
      rebuilt.push(to[to_current_pos]);
      to_current_pos++;
    } else {
      rebuilt.push(from[from_current_pos]);
      from_current_pos++;
      to_current_pos++;
    }
  }

  return rebuilt;
};

describe('diff algotirhm', () => {
  it('both empty', () => {
    expect(diff([], [])).toEqual([]);
  });

  it('identical arrays', () => {
    expect(diff([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  it('from empty (all inserts)', () => {
    const ops = diff([], [1, 2, 3]);
    expect(ops).toEqual([
      { type: 'insert', to: 0 },
      { type: 'insert', to: 1 },
      { type: 'insert', to: 2 },
    ]);
  });

  it('to empty (all deletes)', () => {
    const ops = diff([1, 2, 3], []);
    expect(ops).toEqual([
      { type: 'delete', from: 0 },
      { type: 'delete', from: 1 },
      { type: 'delete', from: 2 },
    ]);
  });

  it('single insert', () => {
    const from = [1, 2, 3];
    const to = [1, 2, 3, 4];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
    expect(ops.length).toBe(1);
    expect(ops.every((o) => o.type === 'insert')).toBe(true);
  });

  it('single delete', () => {
    const from = [1, 2, 3];
    const to = [1, 3];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
    expect(ops.length).toBe(1);
    expect(ops[0]).toEqual({ type: 'delete', from: 1 });
  });

  it('replace single element', () => {
    const from = [1, 2, 3];
    const to = [1, 4, 3];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
    // 1 delete + 1 insert = 2 ops
    expect(ops.length).toBe(2);
  });

  it('completely different arrays', () => {
    const from = [1, 2, 3];
    const to = [4, 5, 6];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
    expect(ops.length).toBe(6); // 3 deletes + 3 inserts
  });

  it('insert at beginning', () => {
    const from = [2, 3];
    const to = [1, 2, 3];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
    expect(ops.length).toBe(1);
  });

  it('insert in middle', () => {
    const from = [1, 3];
    const to = [1, 2, 3];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
    expect(ops.length).toBe(1);
  });

  it('multiple edits', () => {
    const from = [1, 2, 3, 4, 5];
    const to = [1, 3, 4, 5, 6];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
    // delete 2, insert 6 => 2 ops
    expect(ops.length).toBe(2);
  });

  it('string diff', () => {
    const from = 'abcdef'.split('');
    const to = 'abcfgh'.split('');
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
  });

  it('custom equality function', () => {
    const from = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const to = [{ id: 1 }, { id: 3 }];
    const ops = diff(from, to, (a, b) => a.id === b.id);
    expect(apply(from, to, ops)).toEqual(to);
    expect(ops.length).toBe(1);
  });

  it('SES is shortest', () => {
    // diff が最短編集距離を返すことを確認
    const from = [1, 2, 3, 4, 5];
    const to = [2, 3, 4, 5, 6];
    const ops = diff(from, to);
    // 最短: delete 1, insert 6 => 2
    expect(ops.length).toBe(2);
    expect(apply(from, to, ops)).toEqual(to);
  });

  it('large identical prefix and suffix', () => {
    const common = Array.from({ length: 100 }, (_, i) => i);
    const from = [...common, 999, ...common];
    const to = [...common, 888, ...common];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
    expect(ops.length).toBe(2); // 1 delete + 1 insert
  });

  it('single element arrays', () => {
    expect(diff([1], [1])).toEqual([]);
    const ops1 = diff([1], [2]);
    expect(ops1.length).toBe(2);
    expect(apply([1], [2], ops1)).toEqual([2]);
  });

  it('interleaved changes', () => {
    const from = [1, 2, 3, 4, 5, 6];
    const to = [1, 3, 5];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
    // delete 2, 4, 6 => 3 ops
    expect(ops.length).toBe(3);
  });

  it('duplicate elements', () => {
    const from = [1, 1, 1, 2, 2];
    const to = [1, 2, 2, 2];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
  });

  it('reverse order', () => {
    const from = [1, 2, 3, 4, 5];
    const to = [5, 4, 3, 2, 1];
    const ops = diff(from, to);
    expect(apply(from, to, ops)).toEqual(to);
  });
});
