export type Recur<A> = Readonly<{
  type: 'Recur';
  next: boolean;
  return: A;
}>;

export const recur = <A>(a: A): Recur<A> => ({
  type: 'Recur',
  next: true,
  return: a,
});

const isRecur = <A>(a: Recur<A> | A): a is Recur<A> =>
  a != null && typeof a === 'object' && 'type' in a && a.type === 'Recur';

export const loop = <A>(init: A, f: (a: A) => Recur<A> | A): A => {
  let state = {
    next: true,
    return: init,
  };
  while (state.next) {
    const result = f(state.return);
    if (isRecur(result)) {
      state = result;
    } else {
      return result;
    }
  }
  return state.return;
};
