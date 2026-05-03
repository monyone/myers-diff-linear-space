export type Operation = {
  type: 'delete';
  from: number;
} | {
  type: 'insert';
  to: number;
};

const mod = (n: number, m: number): number => {
  return (n + m) % m;
}

const diff = <T,>(from: T[], to: T[], from_begin: number, from_end: number, to_begin: number, to_end: number, eq: (a: T, b: T) => boolean): Operation[] => {
  const from_length = from_end - from_begin;
  const to_length = to_end - to_begin;
  const total_length = from_length + to_length;

  if (from_length === 0 && to_length === 0) {
    return [];
  } else if (from_length > 0 && to_length === 0) {
    return Array.from({ length: from_length }, (_, i) => ({
      type: 'delete',
      from: from_begin + i,
    }));
  } else if (from_length === 0 && to_length > 0) {
    return Array.from({ length: to_length }, (_, i) => ({
      type: 'insert',
      to: to_begin + i,
    }));
  }

  const max_depth = Math.floor((total_length + 1) / 2);
  const compute_length = 2 * Math.min(from_length, to_length) + 2;
  const delta = from_length - to_length;

  const forward = Array.from({ length: compute_length }, () => 0);
  const backward = Array.from({ length: compute_length }, () => 0);
  for (let depth = 0; depth <= max_depth; depth++) {
    for (let direction = 0; direction < 2; direction++) {
      // forward => direction === 0, backward => direction === 1
      const is_forward = direction === 0;
      const current = is_forward ? forward : backward;
      const opposite = is_forward ? backward : forward;

      const from_k = -(depth - 2 * Math.max(0, depth - to_length));
      const to_k = depth - 2 * Math.max(0, depth - from_length);
      for (let k = from_k; k <= to_k; k += 2) {
        const k_minus1 = current[mod(k - 1, compute_length)];
        const k_plus1 = current[mod(k + 1, compute_length)];

        let a = k === -depth || (k !== depth && k_minus1 < k_plus1) ? k_plus1 : k_minus1 + 1;
        let b = a - k;
        const snake_x = a;
        const snake_y = b;
        while (a < from_length && b < to_length) {
          const dir = 1 + -2 * direction; // forward: 1, backward: -1
          const from_index = from_begin + (direction * from_length + (dir * a) - direction);
          const to_index = to_begin + (direction * to_length + (dir * b) - direction);

          if (!eq(from[from_index], to[to_index])) { break; }
          a += 1;
          b += 1;
        }
        current[mod(k, compute_length)] = a;

        const opposite_k = -(k - delta);
        const is_opposite_k_valid = opposite_k >= -(depth - (1 - direction)) && opposite_k <= (depth - (1 - direction));
        // (is_forward && total_length % 2 !== 0) || (!is_forward && total_length % 2 === 0)
        const should_check_overlap = (total_length % 2) === (1 - direction);
        const is_snakes_overlap  = current[mod(k, compute_length)] + opposite[mod(opposite_k, compute_length)] >= from_length;
        if (should_check_overlap && is_opposite_k_valid && is_snakes_overlap) {
          const distance = 2 * depth + (direction - 1);
          const { x, y, u, v } = (() => {
            if (is_forward) {
              const x = snake_x, y = snake_y;
              const u = a, v = b;
              return { x, y, u, v };
            } else {
              const x = from_length - a, y = to_length - b;
              const u = from_length - snake_x, v = to_length - snake_y;
              return { x, y, u, v };
            }
          })();

          if (distance > 1 || (x !== u && y !== v)) {
            return [
              ... diff(from, to, from_begin, from_begin + x, to_begin, to_begin + y, eq),
              ... diff(from, to, from_begin+ u, from_end, to_begin + v, to_end, eq)
            ];
          } else if (from_length > to_length) {
            return diff(from, to, from_begin + to_length, from_end, to_begin + to_length, to_end, eq);
          } else if (from_length < to_length) {
            return diff(from, to, from_begin + from_length, from_end, to_begin + from_length, to_end, eq);
          } else {
            return [];
          }
        }
      }
    }
  }

  /*
    The SES length is at most M+N (all deletes + all inserts),
    so the middle snake is always found within depth <= ceil((M+N)/2).
    The loop above covers this range, meaning this point is never reached.

    SES の長さは最大でも M+N (全削除+全挿入) なので
    middle snake は depth <= ceil((M+N)/2) の範囲で必ず見つかる。
    上のループはこの範囲を網羅しているため、ここには到達しない。
  */
  throw new Error('unreachable: middle snake not found');
}

export default <T,>(a: T[], b: T[], eq: (a: T, b: T) => boolean = (a, b) => a === b): Operation[] => {
  return diff(a, b, 0, a.length, 0, b.length, eq);
}
