import { pipe } from 'fp-ts/lib/function';
import { loop, recur } from './loop';
import { Position, Source } from './stream';
import os from 'os';
import * as nodePath from 'path';
import { ParserContext } from './parser-combinator';
import { Json } from './compiler';
import { readonlyArray } from 'fp-ts';

export type BaseError = UnexpectedError | NotImplementedError | InvalidSyntaxError;

export type ParserError = BaseError & Readonly<{ source: Source; position: Position }>;

export type UnexpectedError = Readonly<{
  type: 'UnexpectedParserError';
  expect?: string;
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
  parserContext: ParserContext;
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

export const isParserError = (self: unknown): self is ParserError =>
  typeof self === 'object' &&
  self !== null &&
  'type' in self &&
  (self.type === 'UnexpectedParserError' ||
    self.type === 'NotImplementedError' ||
    self.type === 'InvalidSyntaxError');

export const isCompileError = (self: unknown): self is CompileError =>
  typeof self === 'object' && self !== null && 'type' in self && self.type === 'CompileError';

export const getActual = (self: ParserError): string =>
  self.type === 'UnexpectedParserError' ? (self.actual ?? '?') : '?';

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
    i === src.length
      ? { i: i - 1, out }
      : src[i] === os.EOL
        ? { i: i - 1, out }
        : recur({ i: i + 1, out: out + src[i] }),
  ).out;

const pointer = (start: RowCol, end: RowCol): string =>
  ' '.repeat(start.column - 1) + '^'.repeat(end.column - start.column);

const formatParserError = (self: ParserError): ReadonlyArray<FormattedError> => [
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
        ? (self.message ?? `Expect '${self.expect}' but got '${getActual(self)}'`)
        : self.message,
    line:
      findLineStart(self.source.data, self.position.index) +
      findLineEnd(self.source.data, self.position.index + 1),
  },
];

const formatCompileError = (self: CompileError): ReadonlyArray<FormattedError> =>
  self.items.map(item => ({
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
  }));

export const toFormattedError = (self: DSLError): ReadonlyArray<FormattedError> =>
  isParserError(self)
    ? formatParserError(self)
    : self.type === 'CompileError'
      ? formatCompileError(self)
      : [
          {
            type: '',
            path: '',
            start: { row: 0, column: 0 },
            end: {
              row: 0,
              column: 0,
            },
            message: '',
            line: '',
          },
        ];

export const prettyString = (self: DSLError): string =>
  self.type !== 'SystemError'
    ? pipe(
        toFormattedError(self),
        readonlyArray.map(({ path, start, end, message, line }) =>
          [
            `${path}(${start.row},${start.column}): ${self.type}: ${message}`,
            '',
            `\t${line}`,
            `\t${pointer(start, end)}`,
            '',
          ].join(os.EOL),
        ),
        _ => _.join(os.EOL),
      )
    : JSON.stringify(self);
