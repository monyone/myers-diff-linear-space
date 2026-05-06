export default <T,>(from: Readonly<ArrayLike<T>>, to: Readonly<ArrayLike<T>>, cost: (a: T, b: T) => number, band = Number.POSITIVE_INFINITY, ) => {
  const N = from.length, M = to.length;

  const DP = Array.from({ length: from.length + 1 }, () => {
    return Array.from({ length: to.length + 1 }, () => Number.POSITIVE_INFINITY);
  });
  DP[0][0] = 0;

  // DP
  for (let i = 1; i <= N; i++) {
    const j_from = Math.max(1, i - band);
    const j_to = Math.min(M , i + band);
    for (let j = j_from; j <= j_to; j++) {
      DP[i][j] = cost(from[i - 1], to[j - 1]) + Math.min(DP[i - 1][j - 0], DP[i - 0][j - 1], DP[i - 1][j - 1]);
    }
  }

  //経路復元
  const path: [number, number][] = [];
  {
    let i = N, j = M;
    while (i > 0 && j > 0) {
      path.push([i - 1, j - 1]);

      let min_index = -1;
      let min_cost = Number.POSITIVE_INFINITY;
      const move = [[i - 1, j - 0], [i - 0, j - 1], [i - 1, j - 1]];
      for (let m = 0; m < move.length; m++) {
        const [i, j] = move[m];
        if (DP[i][j] < min_cost) {
          min_index = m;
          min_cost = DP[i][j];
        }
      }
      ([i, j] = move[min_index]);
    }
  }
  return path.reverse();
}