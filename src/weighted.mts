export type Operation = {
  type: 'delete';
  from: number;
} | {
  type: 'insert';
  to: number;
};

export type WeightedDiffOption = {
  cost?: {
    insert?: number;
    delete?: number;
  };
  bandWidth?: number;
};

export default <T,>(from: Readonly<ArrayLike<T>>, to: Readonly<ArrayLike<T>>, cost: (a: T, b: T) => number, option?: WeightedDiffOption) => {
  const stack: [number, number, number, number][] = [[0, from.length, 0, to.length]];
  const result: Operation[] = [];

  const insert_cost = option?.cost?.insert ?? 1;
  const delete_cost = option?.cost?.delete ?? 1;
  const bandWidth = option?.bandWidth ?? Number.POSITIVE_INFINITY;
  const max_length = to.length + 1;

  const fwd_costs = Array.from({ length: max_length }, () => Number.POSITIVE_INFINITY);
  const rev_costs = Array.from({ length: max_length }, () => Number.POSITIVE_INFINITY);
  const rows = [
    Array.from({ length: max_length }, () => Number.POSITIVE_INFINITY),
    Array.from({ length: max_length }, () => Number.POSITIVE_INFINITY),
  ];

  const fwd_band_range = (gi: number, to_begin: number, to_length: number): [number, number] => {
    const d = Math.floor((gi * to.length) / from.length);
    return [Math.max(1, d - bandWidth - to_begin + 1), Math.min(to_length, d + bandWidth - to_begin + 1)];
  };

  const rev_band_range = (gi: number, to_end: number, to_length: number): [number, number] => {
    const d = Math.floor((gi * to.length) / from.length);
    return [Math.max(1, to_end - (d + bandWidth)), Math.min(to_length, to_end - (d - bandWidth))];
  };

  LOOP:
  while (stack.length > 0) {
    const [from_begin, from_end, to_begin, to_end] = stack.pop()!;
    const from_length = from_end - from_begin;
    const to_length = to_end - to_begin;

    // 少なくともどちらかが length: 0 のケース
    if (from_length === 0 && to_length === 0) {
      continue LOOP;
    } else if (from_length > 0 && to_length === 0) {
      for (let i = 0; i < from_length; i++) {
        result.push({ type: 'delete', from: from_begin + i });
      }
      continue LOOP;
    } else if (from_length === 0 && to_length > 0) {
      for (let i = 0; i < to_length; i++) {
        result.push({ type: 'insert', to: to_begin + i });
      }
      continue LOOP;
    }

    // 少なくともどちらかが length: 1 のケース
    if (from_length === 1) {
      const d = Math.floor((from_begin * to.length) / from.length);
      const jMin = Math.max(0, d - bandWidth - to_begin);
      const jMax = Math.min(to_length - 1, d + bandWidth - to_begin);
      let best_j = -1, best_cost = 1 * delete_cost + to_length * insert_cost;
      for (let j = jMin; j <= jMax; j++) {
        const current_cost = cost(from[from_begin], to[to_begin + j]) + (to_length - 1) * insert_cost;
        if (current_cost < best_cost) {
          best_cost = current_cost;
          best_j = j;
        }
      }
      if (best_j >= 0) {
        for (let j = 0; j < best_j; j++){
          result.push({ type: 'insert', to: to_begin + j });
        }
        for (let j = best_j + 1; j < to_length; j++){
          result.push({ type: 'insert', to: to_begin + j });
        }
      } else {
        result.push({ type: 'delete', from: from_begin });
        for (let j = 0; j < to_length; j++){
          result.push({ type: 'insert', to: to_begin + j });
        }
      }
      continue LOOP;
    }
    if (to_length === 1) {
      const d = Math.floor((to_begin * from.length) / to.length);
      const iMin = Math.max(0, d - bandWidth - from_begin);
      const iMax = Math.min(from_length - 1, d + bandWidth - from_begin);
      let best_i = -1, best_cost = 1 * insert_cost + from_length * delete_cost;
      for (let i = iMin; i <= iMax; i++) {
        const current_cost = cost(from[from_begin + i], to[to_begin]) + (from_length - 1) * delete_cost;
        if (current_cost < best_cost) {
          best_cost = current_cost;
          best_i = i;
        }
      }
      if (best_i >= 0) {
        for (let i = 0; i < best_i; i++) {
          result.push({ type: 'delete', from: from_begin + i});
        }
        for (let i = best_i + 1; i < from_length; i++) {
          result.push({ type: 'delete', from: from_begin + i});
        }
      } else {
        result.push({ type: 'insert', to: to_begin});
        for (let i = 0; i < from_length; i++) {
          result.push({ type: 'delete', from: from_begin + i});
        }
      }
      continue LOOP;
    }

    // 少なくとも両方 length >= 2 のケース
    const midpoint = Math.floor(from_length / 2);
    const fwd_len = midpoint;
    const rev_len = from_length - midpoint

    // forward path
    {
      let prev = 0, curr = 1;
      rows[prev].fill(Number.POSITIVE_INFINITY, 0, to_length + 1);
      rows[prev][0] = 0;
      for (let j = 1; j <= to_length; j++){
        rows[prev][j] = j * insert_cost;
      }
      for (let i = 1; i <= fwd_len; i++) {
        rows[curr].fill(Number.POSITIVE_INFINITY, 0, to_length + 1);
        rows[curr][0] = i * delete_cost; // delete のみ
        const gi = from_begin + i - 1;
        const [jMin, jMax] = fwd_band_range(gi, to_begin, to_length);
        for (let j = jMin; j <= jMax; j++) {
          const match = rows[prev][j - 1] + cost(from[from_begin + i - 1], to[to_begin + j - 1]);
          const del = rows[prev][j - 0] + delete_cost;
          const ins = rows[curr][j - 1] + insert_cost;
          rows[curr][j] = Math.min(match, del, ins);
        }
        [prev, curr] = [curr, prev];
      }
      for (let j = 0; j <= to_length; j++) {
        fwd_costs[j] = rows[prev][j];
      }
    }

    // backward path
    {
      let prev = 0, curr = 1;
      rows[prev].fill(Number.POSITIVE_INFINITY, 0, to_length + 1);
      rows[prev][0] = 0;
      for (let j = 1; j <= to_length; j++) {
        rows[prev][j] = j * insert_cost;
      }
      for (let i = 1; i <= rev_len; i++) {
        rows[curr].fill(Number.POSITIVE_INFINITY, 0, to_length + 1);
        rows[curr][0] = i * delete_cost;
        const gi = from_end - i;
        const [jMin, jMax] = rev_band_range(gi, to_end, to_length);
        for (let j = jMin; j <= jMax; j++) {
          const match = rows[prev][j - 1] + cost(from[from_end - i], to[to_end - j]);
          const del = rows[prev][j] + delete_cost;
          const ins = rows[curr][j - 1] + insert_cost;
          rows[curr][j] = Math.min(match, del, ins);
        }
        [prev, curr] = [curr, prev];
      }
      for (let j = 0; j <= to_length; j++){
        rev_costs[j] = rows[prev][to_length - j];
      }
    }

    // 分割点を探す
    let min_cost = Number.POSITIVE_INFINITY;
    let split = 0;
    for (let j = 0; j <= to_length; j++) {
      const c = fwd_costs[j] + rev_costs[j];
      if (c < min_cost) {
        min_cost = c;
        split = j;
      }
    }

    // 分割点で分割する
    stack.push([from_begin + midpoint, from_end, to_begin + split, to_end]);
    stack.push([from_begin, from_begin + midpoint, to_begin, to_begin + split]);
  }

  return result;
}