import { apply, pipe } from 'fp-ts/lib/function';
import { unit } from './unit';
import { either, task } from 'fp-ts';
import { TaskEither } from 'fp-ts/lib/TaskEither';

export const runTaskEither = <E, A>(self: TaskEither<E, A>): Promise<A> =>
  pipe(
    self,
    task.flatMap(
      either.match(
        e => () => Promise.reject(e),
        a => () => Promise.resolve(a),
      ),
    ),
    apply(unit),
  );
