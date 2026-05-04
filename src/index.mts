export type Operation = {
  type: 'delete';
  from: number;
} | {
  type: 'insert';
  to: number;
};

const mod = (n: number, m: number): number => {
  return ((n % m) + m) % m;
}

export default <T,>(from: Readonly<ArrayLike<T>>, to: Readonly<ArrayLike<T>>, eq: (a: T, b: T) => boolean = (a, b) => a === b): Operation[] => {
  const stack: [number, number, number, number][] = [[0, from.length, 0, to.length]];
  const result: Operation[] = [];

  const max_compute_length = 2 * Math.min(from.length, to.length) + 2;
  const forward = Array.from({ length: max_compute_length }, () => 0);
  const backward = Array.from({ length: max_compute_length }, () => 0);

  LOOP:
  while (stack.length > 0) {
    const [from_begin, from_end, to_begin, to_end] = stack.pop()!;

    const from_length = from_end - from_begin;
    const to_length = to_end - to_begin;
    const total_length = from_length + to_length;

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

    const max_depth = Math.floor((total_length + 1) / 2);
    const compute_length = 2 * Math.min(from_length, to_length) + 2;
    const delta = from_length - to_length;

    // forward/backward を stack での再帰毎に初期化する
    forward.fill(0, 0, compute_length);
    backward.fill(0, 0, compute_length);
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
          const is_snakes_overlap = current[mod(k, compute_length)] + opposite[mod(opposite_k, compute_length)] >= from_length;
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
              // stack なので後で追加した方が先になる
              // 前: [from_begin, from_begin + x, to_begin, to_begin + y]
              // 後: [from_begin + u, from_end, to_begin + v, to_end]
              stack.push([from_begin + u, from_end, to_begin + v, to_end]);
              stack.push([from_begin, from_begin + x, to_begin, to_begin + y]);
            } else if (from_length > to_length) {
              stack.push([from_begin + to_length, from_end, to_begin + to_length, to_end]);
            } else if (from_length < to_length) {
              stack.push([from_begin + from_length, from_end, to_begin + from_length, to_end]);
            }
            continue LOOP;
          }
        }
      }
    }
  }

  return result;
}
