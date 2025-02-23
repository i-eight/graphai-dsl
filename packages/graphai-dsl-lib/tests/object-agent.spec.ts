import { pipe } from 'fp-ts/lib/function';
import { compiler } from '../src';
import { source } from '../src/lib/stream';
import { agents } from '../src/agents';
import { runFileTest } from './helpers';
import { either } from 'fp-ts';

describe('Object Agent', () => {
  test('size', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              { a: 1, b: 2, c: 3} |> Object.size;
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: 3 })),
    ));

  test('keys', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              { a: 1, b: 2, c: 3} |> Object.keys;
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: ['a', 'b', 'c'] })),
    ));

  test('has 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              { a: 1, b: 2, c: 3} |> Object.has('a');
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: true })),
    ));

  test('has 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              { a: 1, b: 2, c: 3} |> Object.has('x');
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: false })),
    ));

  test('has 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              {} |> Object.has('a');
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: false })),
    ));

  test('get 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              { a: 1, b: 2, c: 3} |> Object.get('a');
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: 1 })),
    ));

  test('get 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              { a: 1, b: 2, c: 3} |> Object.get('d');
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: null })),
    ));

  test('get 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              {} |> Object.get('a');
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: null })),
    ));

  test('put 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              {} |> Object.put('a', 1);
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 1 } })),
    ));

  test('put 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              {a: 1, b: 2} |> Object.put('c', 3);
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 1, b: 2, c: 3 } })),
    ));

  test('put 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {a: 1, b: 2, c: 3} |> Object.put('c', 4);
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 1, b: 2, c: 4 } })),
    ));

  test('concat 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              Object.concat({a: 1, b: 2}, {c: 3, d: 4});
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 1, b: 2, c: 3, d: 4 } })),
    ));

  test('concat 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              Object.concat({a: 1, b: 2}, {a: 3, d: 4});
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 3, b: 2, d: 4 } })),
    ));

  test('reduce 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              {a: 1, b: 2, c: 3} |> Object.reduce(0, (sum, kv) -> sum + kv.value);
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: 6 })),
    ));

  test('reduce 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
              @version('0.6');
              {a: 1, b: 2, c: 3} |> Object.reduce({}, (res, kv) -> 
                res |> Object.put(kv.key, kv.value * 2)
              );
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 2, b: 4, c: 6 } })),
    ));

  test('flatMap 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {a: 1, b: 2, c: 3} |> Object.flatMap((kv) -> 
                  Object.fromArray([{key: kv.key, value: kv.value * 2}])
                );
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 2, b: 4, c: 6 } })),
    ));

  test('flatMap 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {a: 1, b: 2, c: 3} |> Object.flatMap((kv) -> {});
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: {} })),
    ));

  test('map 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {a: 1, b: 2, c: 3} |> Object.map((kv) -> 
                  kv.value * 2
                );
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 2, b: 4, c: 6 } })),
    ));

  test('map 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {a: 1, b: 2, c: 3, d: 4} |> Object.map((kv) -> 
                  if kv.key == 'a' || kv.key == 'c' 
                  then kv.value * 2
                  else kv.value
                );
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 2, b: 2, c: 6, d: 4 } })),
    ));

  test('filter 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {a: 1, b: 2, c: 3, d: 4} |> Object.filter((kv) -> 
                  kv.key == 'a' || kv.key == 'c'
                );
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 1, c: 3 } })),
    ));

  test('filter 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {a: 1, b: 2, c: 3, d: 4} |> Object.filter((kv) -> 
                  kv.value % 2 == 0 || kv.key == 'c'
                );
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { b: 2, c: 3, d: 4 } })),
    ));

  test('filter 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {} |> Object.filter((kv) -> 
                  kv.value % 2 == 0 || kv.key == 'c'
                );
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: {} })),
    ));

  test('find 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {a: 1, b: 2, c: 3, d: 4} |> Object.find((kv) -> 
                  kv.key == 'a' || kv.key == 'c'
                );
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { key: 'a', value: 1 } })),
    ));

  test('find 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                {} |> Object.find((kv) -> kv.key == 'a');
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: null })),
    ));

  test('fromArray 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                Object.fromArray([
                  {key: 'a', value: 1},
                  {key: 'b', value: 2},
                  {key: 'c', value: 3},
                ]);
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: { a: 1, b: 2, c: 3 } })),
    ));

  test('fromArray 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                Object.fromArray([]);
            `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: {} })),
    ));

  test('toArray 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                Object.toArray({
                  a: 1,
                  b: 2,
                  c: 3,
                });
            `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [
            { key: 'a', value: 1 },
            { key: 'b', value: 2 },
            { key: 'c', value: 3 },
          ],
        }),
      ),
    ));

  test('toArray 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                Object.toArray({});
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

  test('take 1', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                { a: 1, b: 2, c: 3, d: 4 } |> Object.take(['a', 'c']);
            `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [
            { a: 1, c: 3 },
            { b: 2, d: 4 },
          ],
        }),
      ),
    ));

  test('take 2', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                { a: 1, b: 2, c: 3, d: 4 } |> Object.take(['a', 'e']);
            `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [{ a: 1 }, { b: 2, c: 3, d: 4 }],
        }),
      ),
    ));

  test('take 3', async () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
                @version('0.6');
                { a: 1, b: 2, c: 3, d: 4 } |> Object.take(['e', 'f']);
            `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: [{}, { a: 1, b: 2, c: 3, d: 4 }],
        }),
      ),
    ));
});
