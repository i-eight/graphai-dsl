import { pipe } from 'fp-ts/lib/function';
import { loop, recur } from './loop';
import { Position, Source } from './stream';
import os from 'os';
import * as nodePath from 'path';
import { ParserRange } from './parser-combinator';
import { readonlyArray } from 'fp-ts';

export type BaseError = UnexpectedError | NotImplementedError | InvalidSyntaxError;

export type WithSrcPos<E extends BaseError> = E & Readonly<{ source: Source; position: Position }>;

export type ParserError = WithSrcPos<BaseError>;

export type UnexpectedError = Readonly<{
  type: 'UnexpectedParserError';
  expect?: ReadonlyArray<string>;
  actual?: string;
  message?: string;
  cause?: DSLError;
}>;

export type NotImplementedError = Readonly<{
  type: 'NotImplementedError';
  message: string;
  cause?: DSLError;
}>;

export type InvalidSyntaxError = Readonly<{
  type: 'InvalidSyntaxError';
  message: string;
  cause?: DSLError;
}>;

export type CompileErrorItem = Readonly<{
  message: string;
  parserContext: ParserRange;
}>;

export type CompileError = Readonly<{
  type: 'CompileError';
  items: ReadonlyArray<CompileErrorItem>;
  cause?: DSLError;
}>;

export type SystemError = Readonly<{
  type: 'SystemError';
  message: string;
}>;

export type DSLError = ParserError | CompileError | SystemError;

type RowCol = Readonly<{ row: number; column: number }>;

export type FormattedError = Readonly<{
  type: string;
  path: string;
  start: RowCol;
  end: RowCol;
  message: string;
  line: string;
}>;

export type FormattedErrors = Readonly<{
  type: 'FormattedErrors';
  errors: ReadonlyArray<FormattedError>;
}>;

export const isParserError = (self: unknown): self is ParserError =>
  typeof self === 'object' &&
  self !== null &&
  'type' in self &&
  (self.type === 'UnexpectedParserError' ||
    self.type === 'NotImplementedError' ||
    self.type === 'InvalidSyntaxError');

export const isCompileError = (self: unknown): self is CompileError =>
  typeof self === 'object' && self !== null && 'type' in self && self.type === 'CompileError';

export const isFormatedErrors = (self: unknown): self is FormattedErrors =>
  typeof self === 'object' && self !== null && 'type' in self && self.type === 'FormattedErrors';

export const getActual = (self: ParserError): string =>
  self.type === 'UnexpectedParserError' ? (self.actual ?? '?') : '?';

export const updateExpect =
  (f: (expect: ReadonlyArray<string>) => ReadonlyArray<string>) =>
  (self: ParserError): ParserError =>
    self.type === 'UnexpectedParserError'
      ? {
          ...self,
          expect: self.expect == null ? f([]) : f(self.expect),
        }
      : self;

export const mergeUnexpectedError = (
  e1: WithSrcPos<UnexpectedError>,
  e2: WithSrcPos<UnexpectedError>,
): WithSrcPos<UnexpectedError> => ({
  ...e1,
  expect: [...(e1.expect == null ? [] : e1.expect), ...(e2.expect == null ? [] : e2.expect)],
});

export const mergeParserError = (e1: ParserError, e2: ParserError): ParserError =>
  e1.position.index === e2.position.index &&
  e1.type === 'UnexpectedParserError' &&
  e2.type === 'UnexpectedParserError' &&
  e1.actual === e2.actual
    ? mergeUnexpectedError(e1, e2)
    : e1.position.index > e2.position.index
      ? e1
      : e2;

const findLineStart = (src: string, index: number): string =>
  loop({ i: index, out: '' }, ({ i, out }) =>
    i === 0
      ? { i: 0, out }
      : src[i] === os.EOL
        ? { i: i + 1, out }
        : recur({ i: i - 1, out: src[i] + out }),
  ).out;

const findLineEnd = (src: string, index: number): string =>
  loop({ i: index, out: '' }, ({ i, out }) =>
    i >= src.length
      ? { i: src.length - 1, out }
      : src[i] === os.EOL
        ? { i: i - 1, out }
        : recur({ i: i + 1, out: out + src[i] }),
  ).out;

const pointer = (start: RowCol, end: RowCol): string =>
  ' '.repeat(start.column - 1) + '^'.repeat(end.column - start.column);

const formatParserError = (self: ParserError): FormattedErrors => ({
  type: 'FormattedErrors',
  errors: [
    {
      type: self.type,
      path: self.source.path === '' ? '<No source file>' : nodePath.resolve(self.source.path),
      start: {
        row: self.position.row,
        column: self.position.column,
      },
      end: {
        row: self.position.row,
        column: self.position.column + 1,
      },
      message:
        self.type === 'UnexpectedParserError'
          ? (self.message ?? `Expect '${self.expect?.join(' or ')}' but got '${getActual(self)}'`)
          : self.message,
      line:
        findLineStart(self.source.data, self.position.index) +
        findLineEnd(self.source.data, self.position.index + 1),
    },
  ],
});

const formatCompileError = (self: CompileError): FormattedErrors => ({
  type: 'FormattedErrors',
  errors: self.items.map(item => ({
    type: self.type,
    path:
      item.parserContext.source.path === ''
        ? '<No source file>'
        : nodePath.resolve(item.parserContext.source.path),
    start: {
      row: item.parserContext.start.row,
      column: item.parserContext.start.column,
    },
    end: {
      row: item.parserContext.end.row,
      column: item.parserContext.end.column,
    },
    message: item.message,
    line:
      findLineStart(item.parserContext.source.data, item.parserContext.start.index) +
      findLineEnd(item.parserContext.source.data, item.parserContext.start.index + 1),
  })),
});

export const toFormattedError = (self: DSLError): FormattedErrors =>
  isParserError(self)
    ? formatParserError(self)
    : self.type === 'CompileError'
      ? formatCompileError(self)
      : { type: 'FormattedErrors', errors: [] };

export const prettyString = (self: FormattedErrors): string =>
  pipe(
    self.errors,
    readonlyArray.map(({ type, path, start, end, message, line }) =>
      [
        `${path}(${start.row},${start.column}): ${type}: ${message}`,
        '',
        `\t${line}`,
        `\t${pointer(start, end)}`,
        '',
      ].join(os.EOL),
    ),
    _ => _.join(os.EOL),
  );
