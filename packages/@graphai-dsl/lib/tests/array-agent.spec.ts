import { pipe } from 'fp-ts/lib/function';
import * as compiler from '../src/lib/compiler';
import { agents } from '../src/agents';
import { runFileTest } from './helpers';
import { either } from 'fp-ts';
import { source } from '../src/lib/stream';

describe('Array Agent', () => {
  test('size', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3] |> Array.size;
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: 3 })),
    ));

  test('reduce', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              [1, 2, 3] |> Array.reduce(0, (sum, x) -> sum + x);
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: 6 })),
    ));

  test('flatMap', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                [1, 2, 3] |> Array.flatMap((x) -> [x, x * 2, x * 3]);
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: [1, 2, 3, 2, 4, 6, 3, 6, 9] })),
    ));

  test('map', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3] |> Array.map((_) -> _ * 2);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: [2, 4, 6] })),
    ));

  test('filter 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5, 6] |> Array.filter((_) -> _ % 2 == 0);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: [2, 4, 6] })),
    ));

  test('filter 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              [1, 2, 3, 4, 5, 6] |> Array.filter((_) -> _ > 10);
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: [] })),
    ));

  test('find 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5, 6] |> Array.find((_) -> _ % 2 == 0);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: 2 })),
    ));

  test('find 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5, 6] |> Array.find((_) -> _ > 10);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: null })),
    ));

  test('some 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5, 6] |> Array.some((_) -> _ < 4);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: true })),
    ));

  test('some 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5, 6] |> Array.some((_) -> _ > 10);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: false })),
    ));

  test('some 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [] |> Array.some((_) -> _ > 10);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: false })),
    ));

  test('every 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4] |> Array.every((_) -> _ < 5);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: true })),
    ));

  test('every 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4] |> Array.every((_) -> _ < 4);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: false })),
    ));

  test('every 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [] |> Array.every((_) -> _ < 4);
        `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: true })),
    ));

  test('splitAt 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5] |> Array.splitAt(2);
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [
            [1, 2],
            [3, 4, 5],
          ],
        }),
      ),
    ));

  test('splitAt 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5] |> Array.splitAt(10);
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [[1, 2, 3, 4, 5], []],
        }),
      ),
    ));

  test('splitAt 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [] |> Array.splitAt(10);
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [[], []],
        }),
      ),
    ));

  test('head 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3] |> Array.head;
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: 1,
        }),
      ),
    ));

  test('head 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3] |> Array.head;
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: 1,
        }),
      ),
    ));

  test('head 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [] |> Array.head;
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: null,
        }),
      ),
    ));

  test('tail 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5] |> Array.tail;
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [2, 3, 4, 5],
        }),
      ),
    ));

  test('tail 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1] |> Array.tail;
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [],
        }),
      ),
    ));

  test('tail 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [] |> Array.tail;
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [],
        }),
      ),
    ));

  test('sort 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5] |> Array.sort((_) -> _.first - _.second);
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [1, 2, 3, 4, 5],
        }),
      ),
    ));

  test('sort 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            [1, 2, 3, 4, 5] |> Array.sort((_) -> _.second - _.first);
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [5, 4, 3, 2, 1],
        }),
      ),
    ));

  test('concat 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            Array.concat([1, 2, 3], [4, 5]);
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [1, 2, 3, 4, 5],
        }),
      ),
    ));

  test('range 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            Array.range(0, 5);
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [0, 1, 2, 3, 4],
        }),
      ),
    ));

  test('range 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              Array.range(5, 10);
          `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [5, 6, 7, 8, 9],
        }),
      ),
    ));

  test('range 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                Array.range(10, 5);
            `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [10, 9, 8, 7, 6],
        }),
      ),
    ));

  test('zip 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            Array.zip([1, 2, 3], [4, 5, 6]);
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [
            [1, 4],
            [2, 5],
            [3, 6],
          ],
        }),
      ),
    ));

  test('zip 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
            @version('0.6');
            Array.zip([1, 2, 3], [4, 5]);
        `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [
            [1, 4],
            [2, 5],
          ],
        }),
      ),
    ));
});
