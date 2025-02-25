import { either } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { StateT2 } from 'fp-ts/lib/StateT';
import { unit, Unit } from './unit';

export type StateEither<S, E, A> = StateT2<either.URI, S, E, A>;

export namespace stateEither {
  export const right =
    <S, E, A>(a: A): StateEither<S, E, A> =>
    (s: S) =>
      either.right([a, s]);

  export const left =
    <S, E, A>(e: E): StateEither<S, E, A> =>
    (_s: S) =>
      either.left(e);

  export const fromEither =
    <S, E, A>(e: either.Either<E, A>): StateEither<S, E, A> =>
    (s: S) =>
      pipe(
        e,
        either.map(a => [a, s]),
      );

  export const map =
    <S, E, A, B>(f: (a: A) => B) =>
    (self: StateEither<S, E, A>): StateEither<S, E, B> =>
    (s: S) =>
      pipe(
        self(s),
        either.map(([a, s]) => [f(a), s]),
      );

  export const flatMap =
    <S, E, A, B>(f: (a: A) => StateEither<S, E, B>) =>
    (self: StateEither<S, E, A>): StateEither<S, E, B> =>
    (s: S) =>
      pipe(
        self(s),
        either.flatMap(([a, s]) => f(a)(s)),
      );

  export const tap =
    <S, E, A, B>(f: (a: A) => StateEither<S, E, B>) =>
    (self: StateEither<S, E, A>): StateEither<S, E, A> =>
    (s: S) =>
      pipe(
        self(s),
        either.flatMap(([a, s]) =>
          pipe(
            f(a)(s),
            either.map(([_, s]) => [a, s]),
          ),
        ),
      );

  export const bind =
    <N extends string, S, E, A, B>(name: Exclude<N, keyof A>, f: (a: A) => StateEither<S, E, B>) =>
    (
      self: StateEither<S, E, A>,
    ): StateEither<S, E, Readonly<{ [K in keyof A | N]: K extends keyof A ? A[K] : B }>> =>
    (s: S) =>
      pipe(
        self(s),
        either.flatMap(([a, s]) =>
          pipe(
            f(a)(s),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            either.map(([b, s]) => [{ ...a, [name]: b }, s] as any),
          ),
        ),
      );

  export const let_ =
    <N extends string, S, E, A, B>(name: Exclude<N, keyof A>, f: (a: A) => B) =>
    (
      self: StateEither<S, E, A>,
    ): StateEither<S, E, Readonly<{ [K in keyof A | N]: K extends keyof A ? A[K] : B }>> =>
      pipe(
        self,
        bind(name, a => right(f(a))),
      );

  export const orElse =
    <S, E, A>(f: (e: E) => StateEither<S, E, A>) =>
    (self: StateEither<S, E, A>): StateEither<S, E, A> =>
    (s: S) =>
      pipe(
        self(s),
        either.orElse(e => f(e)(s)),
      );

  export const get =
    <S, E>(): StateEither<S, E, S> =>
    (s: S) =>
      either.right([s, s]);

  export const modify =
    <S, E>(f: (s: S) => S): StateEither<S, E, Unit> =>
    (s: S) =>
      either.right([unit, f(s)]);

  export const put = <S, E>(s: S): StateEither<S, E, Unit> => modify(() => s);
}
