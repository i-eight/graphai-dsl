import { pipe } from 'fp-ts/lib/function';
import { either, readonlyArray } from 'fp-ts';
import * as error from '../src/lib/error';
import { compileFromFile } from '../src/lib/compiler';
import { agents } from '../src/agents';
import { Either } from 'fp-ts/lib/Either';
import { printJson } from './helpers';
import { dslParser } from '../src';
import { parser } from '../src/lib/parser-combinator';
import { source, stream } from '../src/lib/stream';

export const formattedErrorMatcher =
  (errors: ReadonlyArray<error.FormattedError>) =>
  (res: Either<error.DSLError, unknown>): void =>
    pipe(
      res,
      either.match(
        e => {
          const es = error.toFormattedError(e);
          expect(es.errors.length).toBe(errors.length);
          readonlyArray.zip(es.errors, errors).forEach(([a, b]) => {
            const { path: p1, ...o1 } = a;
            const { path: p2, ...o2 } = b;
            expect(p1).toContain(p2);
            expect(o1).toStrictEqual(o2);
          });
        },
        () => {
          throw new Error('it should be an error');
        },
      ),
    );

export const printFormattedError = (res: Either<error.DSLError, unknown>): void =>
  pipe(
    res,
    either.match(
      e => {
        console.log(JSON.stringify(error.toFormattedError(e), null, 2));
        console.error(error.prettyString(error.toFormattedError(e)));
      },
      () => {
        throw new Error('it should be an error');
      },
    ),
  );

describe('error', () => {
  test('error 1', () =>
    pipe(
      compileFromFile('./tests/cases/error/error-1.graphai', agents),
      formattedErrorMatcher([
        {
          path: 'tests/cases/error/error-1.graphai',
          type: 'UnexpectedParserError',
          start: {
            row: 3,
            column: 8,
          },
          end: {
            row: 3,
            column: 9,
          },
          message: "Expect '->' but got '='",
          line: 'f = () => a + b;',
        },
      ]),
    ));

  test('error 2', () =>
    pipe(
      compileFromFile('./tests/cases/error/error-2.graphai', agents),
      formattedErrorMatcher([
        {
          type: 'UnexpectedParserError',
          path: 'tests/cases/error/error-2.graphai',
          start: {
            row: 4,
            column: 1,
          },
          end: {
            row: 4,
            column: 2,
          },
          message: "Expect ';' but got 'g'",
          line: 'g = () -> a + b;',
        },
      ]),
    ));

  test('error 3', () =>
    pipe(
      compileFromFile('./tests/cases/error/error-3.graphai', agents),
      formattedErrorMatcher([
        {
          type: 'CompileError',
          path: 'tests/cases/error/error-3.graphai',
          start: {
            row: 4,
            column: 1,
          },
          end: {
            row: 4,
            column: 2,
          },
          message: "Identifier 'a' is already defined",
          line: 'a = 2;',
        },
      ]),
    ));

  test('error 4', () =>
    pipe(
      // dslParser.computedNode,
      // parser.run(stream.create(source.of('', 'a === 1'))),
      // printJson,
      compileFromFile('./tests/cases/error/error-4.graphai', agents),
      formattedErrorMatcher([
        {
          type: 'UnexpectedParserError',
          path: 'tests/cases/error/error-4.graphai',
          start: {
            row: 3,
            column: 15,
          },
          end: {
            row: 3,
            column: 16,
          },
          message: "Expect 'expression' but got '='",
          line: 'a = () -> b === 1;',
        },
      ]),
    ));
});
