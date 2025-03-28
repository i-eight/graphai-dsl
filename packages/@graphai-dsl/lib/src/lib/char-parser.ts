import { either, option } from 'fp-ts';
import { Parser, parser } from './parser-combinator';
import { pipe } from 'fp-ts/lib/function';
import { stream } from './stream';
import os from 'os';
import { unit, Unit } from './unit';

export const eos: Parser<Unit> = parser.create(s =>
  s.stream.position.index < s.stream.source.data.length
    ? either.left({
        type: 'UnexpectedParserError',
        message: 'Expect end of stream',
        source: s.stream.source,
        position: s.stream.position,
      })
    : either.right({ state: s, data: unit }),
);

export const matchedChar = (f: (c: string) => boolean, expect: string): Parser<string> =>
  parser.create(s =>
    pipe(
      stream.head(s.stream),
      option.match(
        () =>
          either.left({
            type: 'UnexpectedParserError',
            message: `Expect ${expect} but failed to get a next char in the stream`,
            source: s.stream.source,
            position: s.stream.position,
          }),
        c =>
          f(c)
            ? either.right({ state: { ...s, stream: stream.tail(s.stream) }, data: c })
            : either.left({
                type: 'UnexpectedParserError',
                expect: [expect],
                actual: c,
                source: s.stream.source,
                position: s.stream.position,
              }),
      ),
    ),
  );

export const char = (expect: string): Parser<string> => matchedChar(c => c === expect, expect);

export const text = (expect: string, index: number = 0): Parser<string> =>
  index >= expect.length
    ? parser.of('')
    : pipe(
        parser.unit,
        parser.bind('x', () => char(expect[index])),
        parser.bind('xs', () => text(expect, index + 1)),
        parser.map(({ x, xs }) => x + xs),
        parser.orElse(e =>
          parser.fail({
            type: 'UnexpectedParserError',
            expect: [expect],
            actual: e.type === 'UnexpectedParserError' ? e.actual : '?',
          }),
        ),
      );

export const space: Parser<string> = matchedChar(c => c === ' ' || c === '\t', 'space');

export const spaces: Parser<string> = parser.repeat('', acc =>
  pipe(
    space,
    parser.map(s => acc + s),
  ),
);

export const spaces1: Parser<string> = pipe(
  space,
  parser.flatMap(a =>
    pipe(
      spaces,
      parser.map(b => a + b),
    ),
  ),
);

export const whitespace: Parser<string> = matchedChar(
  c => c === ' ' || c === '\t' || c === os.EOL,
  'whitespace',
);

export const whitespaces: Parser<string> = parser.repeat('', acc =>
  pipe(
    whitespace,
    parser.map(s => acc + s),
  ),
);

export const whitespaces1: Parser<string> = pipe(
  whitespace,
  parser.flatMap(a =>
    pipe(
      whitespaces,
      parser.map(b => a + b),
    ),
  ),
);

export const anyChar: Parser<string> = matchedChar(_ => true, 'any character');

export const oneOf = (chars: string): Parser<string> =>
  matchedChar(c => chars.includes(c), `one of ${chars}`);

export const noneOf = (chars: string): Parser<string> =>
  matchedChar(c => !chars.includes(c), `none of ${chars}`);

export const digit: Parser<string> = matchedChar(c => '0' <= c && c <= '9', 'digit');

export const alphabet: Parser<string> = matchedChar(
  c => ('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z'),
  'alphabet',
);

export const alphaNum: Parser<string> = pipe(
  alphabet,
  parser.or(digit),
  parser.orElse(cause =>
    parser.fail({
      type: 'UnexpectedParserError',
      expect: ['alphabet', 'digit'],
      actual: cause.type === 'UnexpectedParserError' ? cause.actual : '?',
      cause,
    }),
  ),
);
