import { Kind, URIS } from 'fp-ts/HKT';
import { Monad1 } from 'fp-ts/lib/Monad';
import * as rxjs from 'rxjs';
import { Task } from 'fp-ts/lib/Task';
import { task } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

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

export const loopM =
  <F extends URIS, A>(
    m: Monad1<F> &
      Readonly<{
        create: (_: (callback: (a: A) => void) => void) => Kind<F, A>;
        run: (_: Kind<F, void>) => void;
      }>,
  ) =>
  (init: A, f: (a: A) => Kind<F, Recur<A> | A>): Kind<F, A> =>
    m.create(callback => {
      const subject = new rxjs.Subject<A>();
      subject.subscribe({
        next: (a: A) =>
          pipe(
            m.map(f(a), r => {
              if (isRecur(r)) {
                subject.next(r.return);
              } else {
                subject.complete();
                callback(r);
              }
            }),
            m.run,
          ),
      });
      subject.next(init);
    });

export const loopTask = <A>(init: A, f: (a: A) => Task<Recur<A> | A>): Task<A> =>
  loopM<task.URI, A>({
    ...task.Monad,
    create: g => () => new Promise<A>(g),
    run: _ => _(),
  })(init, f);
