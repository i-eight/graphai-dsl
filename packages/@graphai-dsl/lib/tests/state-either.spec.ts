import { pipe } from 'fp-ts/lib/function';
import { stateEither } from '../src/lib/state-either';
import { either } from 'fp-ts';

describe('StateEither', () => {
  test('right', () => {
    pipe(stateEither.right<string, Error, number>(1)('state'), _ =>
      expect(_).toStrictEqual(either.right([1, 'state'])),
    );
  });

  test('flatMap', () => {
    pipe(
      stateEither.right<string, Error, number>(1),
      stateEither.flatMap(a => stateEither.right<string, Error, number>(a + 1)),
      f => expect(f('state')).toStrictEqual(either.right([2, 'state'])),
    );
  });

  test('bind', () => {
    pipe(
      stateEither.right<string, Error, object>({}),
      stateEither.bind('x', () => stateEither.right<string, Error, number>(1)),
      f => expect(f('state')).toStrictEqual(either.right([{ x: 1 }, 'state'])),
    );
  });

  test('let', () => {
    pipe(
      stateEither.right<string, Error, object>({}),
      stateEither.let_('x', () => 1),
      f => expect(f('state')).toStrictEqual(either.right([{ x: 1 }, 'state'])),
    );
  });

  test('orElse', () => {
    pipe(
      stateEither.left<string, Error, number>(Error('error')),
      stateEither.orElse(() => stateEither.right<string, Error, number>(1)),
      f => expect(f('state')).toStrictEqual(either.right([1, 'state'])),
    );
  });

  test('get', () => {
    pipe(
      stateEither.get<number, Error>(),
      stateEither.map(s => s + 1),
      f => expect(f(1)).toStrictEqual(either.right([2, 1])),
    );
  });
});
