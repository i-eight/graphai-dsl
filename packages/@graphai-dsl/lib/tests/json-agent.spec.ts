import { pipe } from 'fp-ts/lib/function';
import { compiler } from '../src';
import { source } from '../src/lib/stream';
import { agents } from '../src/agents';
import { runFileTest } from './helpers';
import { either } from 'fp-ts';

describe('Json Agent', () => {
  it('stringify 1', () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
          @version('0.6');
          { a: 1, b: [1, 'hoge', true], c: 3} |> Json.stringify;
          `,
        ),
        agents,
      ),
      runFileTest(either.right({ __anon0__: '{"a":1,"b":[1,"hoge",true],"c":3}' })),
    ));

  it('prettryStringify 1', () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
          @version('0.6');
          { a: 1, b: [1, 'hoge', true], c: 3} |> Json.prettyStringify;
          `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: `{
  "a": 1,
  "b": [
    1,
    "hoge",
    true
  ],
  "c": 3
}`,
        }),
      ),
    ));

  it('parse 1', () =>
    pipe(
      compiler.compileFromString(
        source.fromData(
          `
          @version('0.6');
          '{"a":1,"b":[1,"hoge",true],"c":3}' |> Json.parse;
          `,
        ),
        agents,
      ),
      runFileTest(
        either.right({
          __anon0__: { a: 1, b: [1, 'hoge', true], c: 3 },
        }),
      ),
    ));
});
