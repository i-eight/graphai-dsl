import { pipe } from 'fp-ts/lib/function';
import * as compiler from '../src/lib/compiler';
import { agents } from '../src/agents';
import { runFileTest } from './helpers';
import { either } from 'fp-ts';
import { source } from '../src/lib/stream';

describe('Embedded Agents', () => {
  test('array module 1', async () =>
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
});
