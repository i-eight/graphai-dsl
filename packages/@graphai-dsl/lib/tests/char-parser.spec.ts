import { stream } from '../src/lib/stream';
import {
  alphabet,
  alphaNum,
  anyChar,
  char,
  digit,
  eos,
  matchedChar,
  noneOf,
  oneOf,
  space,
  spaces,
  spaces1,
  text,
  whitespaces,
  whitespaces1,
} from '../src/lib/char-parser';
import { parser } from '../src/lib/parser-combinator';
import { pipe } from 'fp-ts/lib/function';
import { either } from 'fp-ts';
import { unit } from '../src/lib/unit';
import os from 'os';

describe('char-parser', () => {
  test('eos', () => {
    pipe(
      eos,
      parser.run(stream.fromData('')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right(unit)),
    );

    pipe(
      eos,
      parser.run(stream.fromData('a')),
      either.mapLeft(_ => (_.type === 'UnexpectedParserError' ? _.message : '')),
      _ => expect(_).toStrictEqual(either.left('Expect end of stream')),
    );
  });

  test('matchedChar', () => {
    pipe(
      matchedChar(c => c === 'a', 'a'),
      parser.run(stream.fromData('a')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('a')),
    );

    pipe(
      matchedChar(c => c === 'a', 'a'),
      parser.run(stream.fromData('b')),
      either.mapLeft(_ =>
        _.type === 'UnexpectedParserError' ? { expect: _.expect, actual: _.actual } : {},
      ),
      _ => expect(_).toStrictEqual(either.left({ expect: ['a'], actual: 'b' })),
    );

    pipe(
      matchedChar(c => c === 'a', 'a'),
      parser.run(stream.fromData('')),
      either.mapLeft(_ => (_.type === 'UnexpectedParserError' ? _.message : '')),
      _ =>
        expect(_).toStrictEqual(
          either.left('Expect a but failed to get a next char in the stream'),
        ),
    );
  });

  test('char', () => {
    pipe(
      char('a'),
      parser.run(stream.fromData('a')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('a')),
    );

    pipe(
      char('a'),
      parser.run(stream.fromData('b')),
      either.mapLeft(_ =>
        _.type === 'UnexpectedParserError' ? { expect: _.expect, actual: _.actual } : {},
      ),
      _ => expect(_).toStrictEqual(either.left({ expect: ['a'], actual: 'b' })),
    );

    pipe(
      char('a'),
      parser.run(stream.fromData('')),
      either.mapLeft(_ => (_.type === 'UnexpectedParserError' ? _.message : '')),
      _ =>
        expect(_).toStrictEqual(
          either.left('Expect a but failed to get a next char in the stream'),
        ),
    );
  });

  test('text', () => {
    pipe(
      text('hoge'),
      parser.run(stream.fromData('hoge')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('hoge')),
    );

    pipe(
      text('hoge'),
      parser.or(text('fuga')),
      parser.run(stream.fromData('fuga')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('fuga')),
    );

    pipe(
      text('hoge'),
      parser.run(stream.fromData('hoga')),
      either.map(_ => _.data),
      _ =>
        expect(_).toStrictEqual(
          either.left({
            type: 'UnexpectedParserError',
            expect: ['hoge'],
            actual: 'a',
            source: {
              data: 'hoga',
              path: '',
            },
            position: {
              index: 0,
              row: 1,
              column: 1,
            },
          }),
        ),
    );
  });

  test('space', () => {
    pipe(
      space,
      parser.run(stream.fromData(' ')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right(' ')),
    );

    pipe(
      space,
      parser.run(stream.fromData('\t')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('\t')),
    );
  });

  test('spaces', () => {
    pipe(
      spaces,
      parser.run(stream.fromData(' \t ')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right(' \t ')),
    );

    pipe(
      spaces,
      parser.run(stream.fromData('')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('')),
    );
  });

  test('spaces1', () => {
    pipe(
      spaces1,
      parser.run(stream.fromData(' \t ')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right(' \t ')),
    );

    pipe(spaces1, parser.run(stream.fromData('a')), _ =>
      expect(_).toStrictEqual(
        either.left({
          type: 'UnexpectedParserError',
          actual: 'a',
          expect: ['space'],
          source: {
            data: 'a',
            path: '',
          },
          position: {
            index: 0,
            row: 1,
            column: 1,
          },
        }),
      ),
    );
  });

  test('whitespaces', () => {
    const source = ` ${os.EOL} `;
    pipe(
      whitespaces,
      parser.run(stream.fromData(source)),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right(source)),
    );

    pipe(
      whitespaces,
      parser.run(stream.fromData('')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('')),
    );
  });

  test('whitespaces1', () => {
    const source = ` ${os.EOL} `;
    pipe(
      whitespaces1,
      parser.run(stream.fromData(source)),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right(source)),
    );

    pipe(whitespaces1, parser.run(stream.fromData('a')), _ =>
      expect(_).toStrictEqual(
        either.left({
          type: 'UnexpectedParserError',
          expect: ['whitespace'],
          actual: 'a',
          source: {
            data: 'a',
            path: '',
          },
          position: {
            index: 0,
            row: 1,
            column: 1,
          },
        }),
      ),
    );

    pipe(whitespaces1, parser.run(stream.fromData('')), _ =>
      expect(_).toStrictEqual(
        either.left({
          type: 'UnexpectedParserError',
          message: 'Expect whitespace but failed to get a next char in the stream',
          source: {
            data: '',
            path: '',
          },
          position: {
            index: 0,
            row: 1,
            column: 1,
          },
        }),
      ),
    );
  });

  test('anyChar', () => {
    pipe(
      anyChar,
      parser.run(stream.fromData('a')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('a')),
    );
  });

  test('oneOf', () => {
    pipe(
      oneOf('abcd'),
      parser.run(stream.fromData('b')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('b')),
    );

    pipe(oneOf('abcd'), parser.run(stream.fromData('x')), _ =>
      expect(_).toStrictEqual(
        either.left({
          type: 'UnexpectedParserError',
          expect: ['one of abcd'],
          actual: 'x',
          source: {
            data: 'x',
            path: '',
          },
          position: {
            index: 0,
            row: 1,
            column: 1,
          },
        }),
      ),
    );
  });

  test('noneOf', () => {
    pipe(noneOf('abcd'), parser.run(stream.fromData('x')), _ =>
      either.right({
        stream: {
          source: 'x',
          position: {
            index: 1,
            row: 1,
            column: 2,
          },
        },
        data: 'x',
      }),
    );

    pipe(noneOf('abcd'), parser.run(stream.fromData('c')), _ =>
      either.left({
        type: 'UnexpectedParserError',
        expect: 'none of abcd',
        actual: 'c',
        position: {
          index: 0,
          row: 1,
          column: 1,
        },
      }),
    );
  });

  test('digit', () => {
    pipe(
      digit,
      parser.run(stream.fromData('1')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('1')),
    );

    pipe(digit, parser.run(stream.fromData('a')), _ =>
      either.left({
        type: 'UnexpectedParserError',
        expect: 'digit',
        actual: 'a',
        position: {
          index: 0,
          row: 1,
          column: 1,
        },
      }),
    );
  });

  test('alphabet', () => {
    pipe(
      alphabet,
      parser.run(stream.fromData('a')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('a')),
    );

    pipe(
      alphabet,
      parser.run(stream.fromData('Z')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('Z')),
    );

    pipe(alphabet, parser.run(stream.fromData('1')), _ =>
      either.left({
        type: 'UnexpectedParserError',
        expect: 'alphabet',
        actual: '1',
        position: {
          index: 0,
          row: 1,
          column: 1,
        },
      }),
    );
  });

  test('alphaNum', () => {
    pipe(
      alphaNum,
      parser.run(stream.fromData('a')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('a')),
    );

    pipe(
      alphabet,
      parser.run(stream.fromData('Z')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('Z')),
    );

    pipe(
      alphaNum,
      parser.run(stream.fromData('0')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('0')),
    );

    pipe(
      alphaNum,
      parser.run(stream.fromData('9')),
      either.map(_ => _.data),
      _ => expect(_).toStrictEqual(either.right('9')),
    );

    pipe(alphaNum, parser.run(stream.fromData('-')), _ =>
      either.left({
        type: 'UnexpectedParserError',
        expect: 'alphabet or digit',
        actual: '-',
        position: {
          index: 0,
          row: 1,
          column: 1,
        },
      }),
    );
  });
});
