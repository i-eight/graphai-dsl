import { constant, pipe } from 'fp-ts/lib/function';

export const through =
  <A, B>(f: (a: A) => B) =>
  (a: A): A =>
    pipe(f(a), constant(a));
