import { identity, pipe } from 'fp-ts/lib/function';
import {
  alphabet,
  alphaNum,
  anyChar,
  char,
  digit,
  eos,
  noneOf,
  text,
  whitespace,
} from './char-parser';
import {
  AgentCall,
  Agentable,
  AgentDef,
  ArrayAt,
  Arrayable,
  BlockComment,
  ComputedNode,
  ComputedNodeBody,
  DSLArray,
  DSLBoolean,
  DSLNull,
  DSLNumber,
  DSLObject,
  DSLString,
  Expr,
  File,
  Graph,
  Identifier,
  IfThenElse,
  LineComment,
  Logical,
  MulDivMod,
  NestedGraph,
  Node,
  AgentContext,
  ObjectMember,
  Paren,
  PlusMinus,
  Power,
  StaticNode,
  TermLogical,
  TermMulDivMod,
  TermPlusMinus,
  Objectable,
  Call,
  TermRelational,
  Relational,
  TermEquality,
  Equality,
  Term,
  TermPower,
  Statements,
  TermPipeline,
  Pipeline,
  Import,
  Modifier,
  NativeImport,
  ArrayDestructuring,
  Destructuring,
  ObjectPairDestructuring,
  ObjectDestructuring,
} from './dsl-syntax-tree';
import { Parser, parser, ParserRange } from './parser-combinator';
import { option, readonlyArray } from 'fp-ts';
import os from 'os';
import { Unit, unit } from './unit';
import { Option } from 'fp-ts/lib/Option';
import { loop, recur } from './loop';
import * as error from './error';
import { toReadableJson } from './dsl-util';

export const reservedWords: ReadonlyArray<string> = [
  'static',
  'if',
  'then',
  'else',
  'true',
  'false',
  'null',
];

export const blockComment: Parser<BlockComment> = pipe(
  text('/*'),
  parser.right(
    parser.repeat('', a =>
      pipe(
        parser.notFollowedBy(text('*/')),
        parser.right(anyChar),
        parser.map(s => a + s),
      ),
    ),
  ),
  parser.left(text('*/')),
  parser.range(value => ({ type: 'BlockComment', value })),
);

export const lineComment: Parser<LineComment> = pipe(
  text('//'),
  parser.right(
    parser.repeat('', a =>
      pipe(
        parser.notFollowedBy(
          pipe(
            text(os.EOL),
            parser.map(_ => unit),
            parser.or(eos),
          ),
        ),
        parser.right(anyChar),
        parser.map(s => a + s),
      ),
    ),
  ),
  parser.left(
    pipe(
      text(os.EOL),
      parser.map(_ => unit),
      parser.or(eos),
    ),
  ),
  parser.range(value => ({ type: 'LineComment', value })),
);

export const ignoredToken: Parser<ReadonlyArray<BlockComment | LineComment>> = pipe(
  whitespace,
  parser.or<string | BlockComment | LineComment>(blockComment),
  parser.or<string | BlockComment | LineComment>(lineComment),
  parser.map(_ => (typeof _ === 'string' ? [] : [_])),
);

export const whitespaces: Parser<ReadonlyArray<BlockComment | LineComment>> = parser.repeat(
  [] as ReadonlyArray<BlockComment | LineComment>,
  xs =>
    pipe(
      ignoredToken,
      parser.map(s => [...xs, ...s]),
    ),
);

export const whitespaces1: Parser<ReadonlyArray<BlockComment | LineComment>> = pipe(
  parser.unit,
  parser.bind('xs', () => ignoredToken),
  parser.bind('ys', _ => whitespaces),
  parser.map(({ xs, ys }) => [...xs, ...ys]),
);

const underScore = char('_');

export const identifier: Parser<Identifier> = pipe(
  parser.unit,
  parser.flatMap(
    () =>
      pipe(
        text('@context'),
        parser.range(name => ({ type: 'Identifier', name })),
      ) satisfies Parser<Identifier>,
  ),
  parser.orElse(() => nodeIdentifier),
);

export const nodeIdentifier: Parser<Identifier> = pipe(
  parser.unit,
  parser.bind('first', () => pipe(alphabet, parser.or(underScore))),
  parser.orElse(e =>
    parser.fail({
      type: 'UnexpectedParserError',
      expect: ['identifier'],
      actual: error.getActual(e),
      message: `An identifier can not start with ${error.getActual(e)}`,
    }),
  ),
  parser.bind('rest', () =>
    parser.repeat('', a =>
      pipe(
        alphaNum,
        parser.or(underScore),
        parser.map(s => a + s),
      ),
    ),
  ),
  parser.bind('name', ({ first, rest }) => parser.of(first + rest)),
  parser.flatMap(({ name }) =>
    pipe(
      reservedWords,
      readonlyArray.exists(_ => _ === name),
      _ =>
        _
          ? parser.fail<string>({
              type: 'UnexpectedParserError',
              message: `Cannot use '${name}' as an identifier`,
            })
          : parser.of(name),
    ),
  ),
  parser.range(name => ({ type: 'Identifier', name })),
);

export const boolean: Parser<DSLBoolean> = pipe(
  parser.unit,
  parser.bind('value', () =>
    pipe(
      text('true'),
      parser.or(text('false')),
      parser.orElse(e =>
        parser.fail({
          type: 'UnexpectedParserError',
          expect: ['boolean'],
          actual: error.getActual(e),
        }),
      ),
    ),
  ),
  parser.range(({ value }) => ({
    type: 'Boolean',
    value: value === 'true',
  })),
);

export const unsignedInteger: Parser<string> = parser.repeat1('', a =>
  pipe(
    digit,
    parser.map(s => a + s),
  ),
);

export const number: Parser<DSLNumber> = pipe(
  parser.unit,
  parser.bind('sign', () => pipe(char('+'), parser.or(char('-')), parser.or(parser.of('')))),
  parser.bind('uint', () => unsignedInteger),
  parser.bind('decimal', () =>
    pipe(
      char('.'),
      parser.right(unsignedInteger),
      parser.map(_ => `.${_}`),
      parser.or(parser.of('')),
    ),
  ),
  parser.bind('value', ({ sign, uint, decimal }) => parser.of(Number(`${sign}${uint}${decimal}`))),
  parser.orElse(e =>
    parser.fail({ type: 'UnexpectedParserError', expect: ['number'], actual: error.getActual(e) }),
  ),
  parser.range(({ value }) => ({ type: 'Number', value })),
);

const stringQuote = (quote: '"' | "'"): Parser<DSLString> =>
  pipe(
    parser.unit,
    parser.bind('value', () =>
      pipe(
        char(quote),
        parser.right(
          parser.repeat<ReadonlyArray<string | Expr>>([], xs =>
            pipe(
              parser.repeat1<string | Expr>('', a =>
                pipe(
                  text('\\$'),
                  parser.map(_ => '$'),
                  parser.or(
                    pipe(
                      text('\\' + quote),
                      parser.map(_ => quote as string),
                    ),
                  ),
                  parser.or(noneOf(quote + '$')),
                  parser.map(s => a + s),
                ),
              ),
              parser.or<string | Expr>(
                pipe(
                  text('${'),
                  parser.right(whitespaces),
                  parser.flatMap(() => expr),
                  parser.left(whitespaces),
                  parser.left(char('}')),
                ),
              ),
              parser.map(x => [...xs, x]),
            ),
          ),
        ),
        parser.left(char(quote)),
      ),
    ),
    parser.range(({ value }) => ({ type: 'String', value })),
  );

export const string: Parser<DSLString> = pipe(stringQuote('"'), parser.or(stringQuote("'")));

export const array: Parser<DSLArray> = pipe(
  parser.unit,
  parser.bind('value', () =>
    pipe(
      char('['),
      parser.right(whitespaces),
      parser.right(
        pipe(
          parser.unit,
          parser.flatMap(() => expr),
          parser.sepBy(pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces))),
        ),
      ),
      parser.left(
        pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces), parser.optional),
      ),
      parser.left(whitespaces),
      parser.left(char(']')),
    ),
  ),
  parser.range(({ value }) => ({ type: 'Array', value })),
);

export const object: Parser<DSLObject> = pipe(
  parser.unit,
  parser.bind('value', () =>
    pipe(
      char('{'),
      parser.right(whitespaces),
      parser.right(
        pipe(
          parser.unit,
          parser.bind('key', () => identifier),
          parser.left(whitespaces),
          parser.left(char(':')),
          parser.left(whitespaces),
          parser.bind('value', () => expr),
          parser.map(({ key, value }) => ({ key, value })),
          parser.sepBy(pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces))),
        ),
      ),
      parser.left(
        pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces), parser.optional),
      ),
      parser.left(whitespaces),
      parser.left(char('}')),
    ),
  ),
  parser.range(({ value }) => ({ type: 'Object', value })),
);

export const null_: Parser<DSLNull> = pipe(
  parser.unit,
  parser.bind('value', () => text('null')),
  parser.range(() => ({ type: 'Null' })),
);

export const destructuring: Parser<Destructuring> = pipe(
  number,
  parser.or<Destructuring>(string),
  parser.or<Destructuring>(boolean),
  parser.or<Destructuring>(null_),
  parser.or<Destructuring>(identifier),
  parser.or<Destructuring>(() => destructuringArray),
  parser.or<Destructuring>(() => destructuringObject),
);

export const destructuringArray: Parser<ArrayDestructuring> = pipe(
  parser.unit,
  parser.right(char('[')),
  parser.right(whitespaces),
  parser.bind('value', () =>
    pipe(
      destructuring,
      parser.sepBy(pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces))),
    ),
  ),
  parser.bind('rest', () =>
    pipe(
      whitespaces,
      parser.right(char(',')),
      parser.right(whitespaces),
      parser.right(text('...')),
      parser.right(whitespaces),
      parser.right(nodeIdentifier),
      parser.optional,
    ),
  ),
  parser.left(whitespaces),
  parser.left(char(']')),
  parser.range(({ value, rest }) => ({
    type: 'ArrayDestructuring',
    value,
    rest: option.toUndefined(rest),
  })),
);

export const destructuringObjectPair: Parser<ObjectPairDestructuring> = pipe(
  parser.unit,
  parser.bind('key', () => identifier),
  parser.left(whitespaces),
  parser.left(char(':')),
  parser.left(whitespaces),
  parser.bind('value', () => destructuring),
  parser.range(({ key, value }) => ({ type: 'ObjectPairDestructuring', key, value })),
);

export const destructuringObject: Parser<ObjectDestructuring> = pipe(
  parser.unit,
  parser.right(char('{')),
  parser.right(whitespaces),
  parser.bind('value', () =>
    pipe(
      destructuringObjectPair,
      parser.or<Identifier | ObjectPairDestructuring>(identifier),
      parser.sepBy(pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces))),
    ),
  ),
  parser.bind('rest', () =>
    pipe(
      whitespaces,
      parser.right(char(',')),
      parser.right(whitespaces),
      parser.right(text('...')),
      parser.right(whitespaces),
      parser.right(nodeIdentifier),
      parser.optional,
    ),
  ),
  parser.left(
    pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces), parser.optional),
  ),
  parser.left(whitespaces),
  parser.left(char('}')),
  parser.range(({ value, rest }) => ({
    type: 'ObjectDestructuring',
    value,
    rest: option.toUndefined(rest),
  })),
);

export const agentContextPair: Parser<AgentContext> = pipe(
  parser.unit,
  parser.bind('name', () => identifier),
  parser.left(whitespaces),
  parser.left(char('=')),
  parser.left(whitespaces),
  parser.bind('value', () => expr),
  parser.left(whitespaces),
  parser.range(({ name, value }) => ({ type: 'AgentContext', name, value })),
);

export const agentContext: Parser<ReadonlyArray<AgentContext>> = pipe(
  text('@('),
  parser.right(whitespaces),
  parser.right(
    pipe(
      parser.unit,
      parser.right(agentContextPair),
      parser.sepBy1(pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces))),
    ),
  ),
  parser.left(whitespaces),
  parser.left(char(')')),
  parser.or(parser.of<ReadonlyArray<AgentContext>>([])),
);

export const curriedAgentDef = (
  args: ReadonlyArray<Identifier | Destructuring>,
  body: Expr | Graph,
  context: ParserRange,
): AgentDef =>
  pipe(
    loop(
      {
        index: readonlyArray.size(args) - 1,
        result: option.none as Option<AgentDef>,
      },
      ({ index, result }) =>
        index < 0
          ? { index, result }
          : pipe(
              args,
              readonlyArray.lookup(index),
              option.match(
                () => recur({ index, result }),
                arg =>
                  recur({
                    index: index - 1,
                    result: pipe(
                      result,
                      option.match(
                        () =>
                          option.of<AgentDef>({
                            type: 'AgentDef',
                            args: arg,
                            body,
                            context,
                          }),
                        _ =>
                          option.of<AgentDef>({
                            type: 'AgentDef',
                            args: arg,
                            body: _,
                            context,
                          }),
                      ),
                    ),
                  }),
              ),
            ),
    ).result,
    option.getOrElse(() =>
      identity<AgentDef>({
        type: 'AgentDef',
        body,
        context,
      }),
    ),
  );

export const agentDef: Parser<AgentDef> = pipe(
  parser.unit,
  parser.left(char('(')),
  parser.left(whitespaces),
  parser.bind('args', () =>
    pipe(
      identifier,
      parser.or<Identifier | Destructuring>(() => destructuring),
      parser.sepBy(pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces))),
      parser.left(
        pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces), parser.optional),
      ),
    ),
  ),
  parser.left(whitespaces),
  parser.left(char(')')),
  parser.left(whitespaces),
  parser.left(text('->')),
  parser.left(whitespaces),
  parser.bind('body', () =>
    pipe(
      char('{'),
      parser.right(whitespaces),
      parser.flatMap(() =>
        graph(
          pipe(
            whitespaces,
            parser.left(char('}')),
            parser.map(() => unit),
          ),
          option.none,
        ),
      ),
      parser.or<Graph | Expr>(expr),
    ),
  ),
  parser.mapWithRange(({ args, body }, context) => curriedAgentDef(args, body, context)),
);

export const throwOr =
  <A>(errors: ReadonlyArray<error.ParserError['type']>, p: Parser<A> | (() => Parser<A>)) =>
  (self: Parser<A>): Parser<A> =>
    pipe(
      self,
      parser.orElse(e =>
        pipe(
          errors,
          readonlyArray.exists(_ => _ === e.type),
        )
          ? parser.fail(e)
          : typeof p === 'function'
            ? p()
            : p,
      ),
    );

export const invalidOr =
  <A>(p: Parser<A> | (() => Parser<A>)) =>
  (self: Parser<A>): Parser<A> =>
    pipe(self, throwOr(['InvalidSyntaxError'], p));

export const term: Parser<Term> = pipe(
  number,
  parser.or<Term>(string),
  parser.or<Term>(boolean),
  parser.or<Term>(null_),
  parser.or<Term>(array),
  parser.or<Term>(object),
  parser.or<Term>(() => paren),
  parser.or<Term>(() => nestedGraph),
  parser.or<Term>(identifier),
  parser.orElse(e =>
    parser.fail(
      pipe(
        e,
        error.updateExpect(_ => ['expression']),
      ),
    ),
  ),
);

export const isLiteral = (
  term: Expr,
): term is DSLNumber | DSLString | DSLBoolean | DSLArray | DSLObject | DSLNull =>
  term.type === 'Number' ||
  term.type === 'String' ||
  term.type === 'Boolean' ||
  term.type === 'Array' ||
  term.type === 'Object' ||
  term.type === 'Null';

export const isCall = (term: Expr): term is Call =>
  term.type === 'ArrayAt' || term.type === 'ObjectMember' || term.type === 'AgentCall';

export const isArrayable = (term: Expr): term is Arrayable =>
  term.type === 'Array' ||
  term.type === 'Paren' ||
  term.type === 'NestedGraph' ||
  term.type === 'Identifier';

export const arrayAtFrom = (term: Term | Call): Parser<ArrayAt> =>
  pipe(
    parser.unit,
    parser.left(char('[')),
    parser.left(whitespaces),
    parser.bind('index', () => expr),
    parser.left(whitespaces),
    parser.left(char(']')),
    parser.bind('array', () =>
      isArrayable(term) || isCall(term)
        ? parser.of<Arrayable | Call>(term)
        : parser.fail<Arrayable | Call>({
            type: 'InvalidSyntaxError',
            message: `Index access cannot be used for ${term.type}.`,
          }),
    ),
    parser.range(({ index, array }) =>
      identity<Omit<ArrayAt, 'context'>>({
        type: 'ArrayAt',
        array,
        index,
      }),
    ),
  );

export const isObjectable = (term: Expr): term is Objectable =>
  term.type === 'Object' ||
  term.type === 'Paren' ||
  term.type === 'NestedGraph' ||
  term.type === 'Identifier';

export const objectMemberFrom = (term: Term | Call): Parser<ObjectMember> =>
  pipe(
    parser.unit,
    parser.left(whitespaces),
    parser.left(char('.')),
    parser.left(whitespaces),
    parser.bind('key', () => identifier),
    parser.bind('object', () =>
      isObjectable(term) || isCall(term)
        ? parser.of(term)
        : parser.fail<Objectable | Call>({
            type: 'InvalidSyntaxError',
            message: `Object member access cannot be used for ${term.type}.`,
          }),
    ),
    parser.range(({ key, object }) => ({
      type: 'ObjectMember',
      object,
      key,
    })),
  );

export const isAgentable = (term: Expr): term is Agentable =>
  term.type === 'Paren' || term.type === 'NestedGraph' || term.type === 'Identifier';

export const agentCallRecur = (
  agentContext: ReadonlyArray<AgentContext>,
  agent: Agentable | Call,
  args: ReadonlyArray<Expr>,
  context: ParserRange,
): AgentCall =>
  pipe(
    args,
    readonlyArray.reduce(option.none as Option<AgentCall>, (m, arg) =>
      pipe(
        m,
        option.match(
          () =>
            option.of<AgentCall>({
              type: 'AgentCall',
              agentContext,
              agent,
              args: arg,
              context,
            }),
          _ =>
            option.of<AgentCall>({
              type: 'AgentCall',
              agentContext,
              agent: _,
              args: arg,
              context,
            }),
        ),
      ),
    ),
    option.getOrElse(() =>
      identity<AgentCall>({
        type: 'AgentCall',
        agentContext,
        agent,
        context,
      }),
    ),
  );

export const agentCallFrom = (term: Term | Call): Parser<AgentCall> =>
  pipe(
    parser.unit,
    parser.bind('agentContext', () => agentContext),
    parser.left(char('(')),
    parser.left(whitespaces),
    parser.bind('args', () =>
      pipe(
        expr,
        parser.sepBy(pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces))),
        parser.left(
          pipe(whitespaces, parser.right(char(',')), parser.left(whitespaces), parser.optional),
        ),
      ),
    ),
    parser.left(whitespaces),
    parser.left(char(')')),
    parser.bind('agent', () =>
      isAgentable(term) || isCall(term)
        ? parser.of(term)
        : parser.fail<Agentable | Call>({
            type: 'InvalidSyntaxError',
            message: `Agent call cannot be used for ${term.type}.`,
          }),
    ),
    parser.mapWithRange(({ agentContext, agent, args }, context) =>
      agentCallRecur(agentContext, agent, args, context),
    ),
  );

export const callFrom = (term: Term | Call): Parser<Term | Call> =>
  pipe(
    agentCallFrom(term),
    invalidOr<Call>(arrayAtFrom(term)),
    invalidOr<Call>(objectMemberFrom(term)),
    parser.flatMap(_ => pipe(callFrom(_), invalidOr<Term | Call>(parser.of(_)))),
  );

export const call: Parser<Term | Call> = pipe(
  parser.unit,
  parser.bind('term', () => term),
  parser.flatMap(({ term }) => pipe(callFrom(term), invalidOr<Term | Call>(parser.of(term)))),
);

export const isTermPower = (term: Expr): term is TermPower =>
  term.type === 'Number' ||
  term.type === 'Identifier' ||
  term.type === 'Paren' ||
  term.type === 'NestedGraph' ||
  isCall(term);

export const termPower: Parser<Term | TermPower> = call;

export const powerExponent = (term: Term | TermPower | Power): Parser<Power> =>
  pipe(
    whitespaces,
    parser.left(char('^')),
    parser.left(whitespaces),
    parser.bind('base', () =>
      isTermPower(term) || term.type === 'Power'
        ? parser.of(term)
        : parser.fail<TermPower | Power>({
            type: 'InvalidSyntaxError',
            message: `Exponentiation cannot be used for ${term.type}.`,
          }),
    ),
    parser.bind('exponent', () =>
      pipe(
        termPower,
        parser.flatMap(_ =>
          isTermPower(_)
            ? parser.of(_)
            : parser.fail<TermPower>({
                type: 'InvalidSyntaxError',
                message: `'^' cannot be used for ${_.type}.`,
              }),
        ),
      ),
    ),
    parser.range(({ base, exponent }) =>
      identity<Omit<Power, 'context'>>({
        type: 'Power',
        base,
        exponent,
      }),
    ),
    parser.flatMap(power => pipe(powerExponent(power), invalidOr(parser.of(power)))),
  );

export const power: Parser<Term | TermPower | Power> = pipe(
  call,
  parser.flatMap(term =>
    pipe(powerExponent(term), invalidOr<Term | TermPower | Power>(parser.of(term))),
  ),
);

export const isTermMulDivMod = (term: Expr): term is TermMulDivMod =>
  isTermPower(term) || term.type === 'Power';

export const termMulDivMod: Parser<Term | TermMulDivMod> = power;

export const mulDivModRight = (term: Term | TermMulDivMod | MulDivMod): Parser<MulDivMod> =>
  pipe(
    whitespaces,
    parser.bind('operator', () => pipe(char('*'), parser.or(char('/')), parser.or(char('%')))),
    parser.left(whitespaces),
    parser.bind('left', () =>
      isTermMulDivMod(term) || term.type === 'MulDivMod'
        ? parser.of(term)
        : parser.fail<TermMulDivMod | MulDivMod>({
            type: 'InvalidSyntaxError',
            message: `'*', '/' and '%' cannot be used for ${term.type}.`,
          }),
    ),
    parser.bind('right', () =>
      pipe(
        termMulDivMod,
        parser.flatMap(_ =>
          isTermMulDivMod(_)
            ? parser.of(_)
            : parser.fail<TermMulDivMod>({
                type: 'InvalidSyntaxError',
                message: `'*', '/' and '%' cannot be used for ${_.type}.`,
              }),
        ),
      ),
    ),
    parser.range(({ left, operator, right }) =>
      identity<Omit<MulDivMod, 'context'>>({
        type: 'MulDivMod',
        left,
        operator: operator as '*' | '/' | '%',
        right,
      }),
    ),
    parser.flatMap(term => pipe(mulDivModRight(term), invalidOr(parser.of(term)))),
  );

export const mulDivMod: Parser<Term | TermMulDivMod | MulDivMod> = pipe(
  power,
  parser.flatMap(left =>
    pipe(mulDivModRight(left), invalidOr<Term | TermMulDivMod | MulDivMod>(parser.of(left))),
  ),
);

export const isTermPlusMinus = (term: Expr): term is TermPlusMinus =>
  isTermMulDivMod(term) || term.type === 'MulDivMod';

export const termPlusMinus: Parser<Term | TermPlusMinus> = mulDivMod;

export const plusMinusRight = (term: Term | TermPlusMinus | PlusMinus): Parser<PlusMinus> =>
  pipe(
    whitespaces,
    parser.bind('operator', () =>
      pipe(
        parser.notFollowedBy(text('-->')),
        parser.right(parser.notFollowedBy(text('->>'))),
        parser.right(pipe(char('+'), parser.or(char('-')))),
      ),
    ),
    parser.left(whitespaces),
    parser.bind('left', () =>
      isTermPlusMinus(term) || term.type === 'PlusMinus'
        ? parser.of(term)
        : parser.fail<TermPlusMinus | PlusMinus>({
            type: 'InvalidSyntaxError',
            message: `'+', '-' cannot be used for ${term.type}.`,
          }),
    ),
    parser.bind('right', () =>
      pipe(
        termPlusMinus,
        parser.flatMap(_ =>
          isTermPlusMinus(_)
            ? parser.of(_)
            : parser.fail<TermPlusMinus>({
                type: 'InvalidSyntaxError',
                message: `'+', '-' cannot be used for ${_.type}.`,
              }),
        ),
      ),
    ),
    parser.flatMap(({ left, operator, right }) =>
      pipe(
        parser.unit,
        parser.range(() =>
          identity<Omit<PlusMinus, 'context'>>({
            type: 'PlusMinus',
            left,
            operator: operator as '+' | '-',
            right,
          }),
        ),
        parser.flatMap(plusMinus =>
          pipe(plusMinusRight(plusMinus), invalidOr(parser.of(plusMinus))),
        ),
      ),
    ),
  );

export const plusMinus: Parser<Term | TermPlusMinus | PlusMinus> = pipe(
  mulDivMod,
  parser.flatMap(left =>
    pipe(plusMinusRight(left), invalidOr<Term | TermPlusMinus | PlusMinus>(parser.of(left))),
  ),
);

export const isTermRelational = (term: Expr): term is TermRelational =>
  isTermPlusMinus(term) || term.type === 'PlusMinus' || term.type === 'String';

export const termRelational: Parser<Term | TermRelational> = plusMinus;

export const relationalRight = (term: Term | TermRelational | Relational): Parser<Relational> =>
  pipe(
    whitespaces,
    parser.bind('operator', () =>
      pipe(text('<='), parser.or(text('<')), parser.or(text('>=')), parser.or(text('>'))),
    ),
    parser.left(whitespaces),
    parser.bind('left', () =>
      isTermRelational(term) || term.type === 'Relational'
        ? parser.of(term)
        : parser.fail<TermRelational | Relational>({
            type: 'InvalidSyntaxError',
            message: `'<', '<=', '>', '>=' cannot be used for ${term.type}.`,
          }),
    ),
    parser.bind('right', () =>
      pipe(
        termRelational,
        parser.flatMap(_ =>
          isTermRelational(_)
            ? parser.of(_)
            : parser.fail<TermRelational>({
                type: 'InvalidSyntaxError',
                message: `'<', '<=', '>', '>=' cannot be used for ${_.type}.`,
              }),
        ),
      ),
    ),
    parser.flatMap(({ left, operator, right }) =>
      pipe(
        parser.unit,
        parser.range(() =>
          identity<Omit<Relational, 'context'>>({
            type: 'Relational',
            left,
            operator: operator as '<=' | '<' | '>=' | '>',
            right,
          }),
        ),
        parser.flatMap(relational =>
          pipe(relationalRight(relational), invalidOr(parser.of(relational))),
        ),
      ),
    ),
  );

export const relational: Parser<Term | TermRelational | Relational> = pipe(
  plusMinus,
  parser.flatMap(left =>
    pipe(relationalRight(left), invalidOr<Term | TermRelational | Relational>(parser.of(left))),
  ),
);

export const isTermEquality = (term: Expr): term is TermEquality =>
  isTermRelational(term) ||
  term.type === 'Relational' ||
  term.type === 'Boolean' ||
  term.type === 'Array' ||
  term.type === 'Object' ||
  term.type === 'Null';

export const termEquality: Parser<Term | TermEquality> = relational;

export const equalityRight = (term: Term | TermEquality | Equality): Parser<Equality> =>
  pipe(
    whitespaces,
    parser.bind('operator', () => pipe(text('=='), parser.or(text('!=')))),
    parser.left(whitespaces),
    parser.bind('left', () =>
      isTermEquality(term) || term.type === 'Equality'
        ? parser.of(term)
        : parser.fail<TermEquality | Equality>({
            type: 'InvalidSyntaxError',
            message: `'==', '!=' cannot be used for ${term.type}.`,
          }),
    ),
    parser.bind('right', () =>
      pipe(
        termEquality,
        parser.flatMap(_ =>
          isTermEquality(_)
            ? parser.of(_)
            : parser.fail<TermEquality>({
                type: 'InvalidSyntaxError',
                message: `'==', '!=' cannot be used for ${_.type}.`,
              }),
        ),
      ),
    ),
    parser.range(({ left, operator, right }) =>
      identity<Omit<Equality, 'context'>>({
        type: 'Equality',
        left,
        operator: operator as '==' | '!=',
        right,
      }),
    ),
    parser.flatMap(equality => pipe(equalityRight(equality), invalidOr(parser.of(equality)))),
  );

export const equality: Parser<Term | TermEquality | Equality> = pipe(
  relational,
  parser.flatMap(left =>
    pipe(equalityRight(left), invalidOr<Term | TermEquality | Equality>(parser.of(left))),
  ),
);

export const isTermLogical = (term: Expr): term is TermLogical =>
  isTermEquality(term) || term.type === 'Equality';

export const termLogical: Parser<Term | TermLogical> = equality;

export const logicalRight = (term: Term | TermLogical | Logical): Parser<Logical> =>
  pipe(
    whitespaces,
    parser.bind('operator', () => pipe(text('&&'), parser.or(text('||')))),
    parser.left(whitespaces),
    parser.bind('left', () =>
      isTermLogical(term) || term.type === 'Logical'
        ? parser.of(term)
        : parser.fail<TermLogical | Logical>({
            type: 'InvalidSyntaxError',
            message: `'&&', '||' cannot be used for ${term.type}.`,
          }),
    ),
    parser.bind('right', () =>
      pipe(
        termLogical,
        parser.flatMap(_ =>
          isTermLogical(_)
            ? parser.of(_)
            : parser.fail<TermLogical>({
                type: 'InvalidSyntaxError',
                message: `'&&', '||' cannot be used for ${_.type}.`,
              }),
        ),
      ),
    ),
    parser.range(({ left, operator, right }) =>
      identity<Omit<Logical, 'context'>>({
        type: 'Logical',
        left,
        operator: operator as '&&' | '||',
        right,
      }),
    ),
    parser.flatMap(logical => pipe(logicalRight(logical), invalidOr(parser.of(logical)))),
  );

export const logical: Parser<Term | TermLogical | Logical> = pipe(
  equality,
  parser.flatMap(left =>
    pipe(logicalRight(left), invalidOr<Term | TermLogical | Logical>(parser.of(left))),
  ),
);

export const isTermPipeline = (term: Expr): term is TermPipeline =>
  isTermLogical(term) || term.type === 'Logical';

export const termPipeline: Parser<Term | TermPipeline | IfThenElse | AgentDef> = pipe(
  parser.unit,
  parser.flatMap(() => ifThenElse as Parser<Term | TermPipeline | IfThenElse | AgentDef>),
  parser.or<Term | TermPipeline | IfThenElse | AgentDef>(agentDef),
  parser.or<Term | TermPipeline | IfThenElse | AgentDef>(logical),
);

export const pipelineRight = (term: Term | TermPipeline | Pipeline): Parser<Pipeline> =>
  pipe(
    whitespaces,
    parser.bind('operator', () =>
      pipe(
        text('|>'),
        parser.or(text('-->')),
        parser.or(text('>>=')),
        parser.or(text('>>-')),
        parser.or(text('>>')),
        parser.or(text('->>')),
        parser.or(text(':>')),
      ),
    ),
    parser.left(whitespaces),
    parser.bind('left', () =>
      isTermPipeline(term) || term.type === 'Pipeline'
        ? parser.of(term)
        : parser.fail<TermPipeline | Pipeline>({
            type: 'InvalidSyntaxError',
            message: `'|>', '-->', '>>', '>>=', '>>=', '->>', ':>' cannot be used for ${term.type}.`,
          }),
    ),
    parser.bind('right', () =>
      pipe(
        termPipeline,
        parser.flatMap(_ =>
          isTermLogical(_) || _.type === 'IfThenElse' || _.type === 'AgentDef'
            ? parser.of(_)
            : parser.fail<TermPipeline>({
                type: 'InvalidSyntaxError',
                message: `'|>', '-->', '>>', '>>=', '>>=', '->>', ':>' cannot be used for ${_.type}.`,
              }),
        ),
      ),
    ),
    parser.range(({ left, operator, right }) =>
      identity<Omit<Pipeline, 'context'>>({
        type: 'Pipeline',
        left,
        operator: operator as Pipeline['operator'],
        right,
      }),
    ),
    parser.flatMap(pipeline => pipe(pipelineRight(pipeline), invalidOr(parser.of(pipeline)))),
  );

export const pipeline: Parser<Term | TermPipeline | Pipeline> = pipe(
  logical,
  parser.flatMap(left =>
    pipe(pipelineRight(left), invalidOr<Term | TermPipeline | Pipeline>(parser.of(left))),
  ),
);

export const operator = pipeline;

export const ifThenElse: Parser<IfThenElse> = pipe(
  parser.unit,
  parser.left(text('if')),
  parser.left(whitespaces1),
  parser.bind('if_', () => computedNodeBody),
  parser.left(whitespaces1),
  parser.left(text('then')),
  parser.left(whitespaces1),
  parser.bind('then_', () => computedNodeBody),
  parser.left(whitespaces1),
  parser.left(text('else')),
  parser.left(whitespaces1),
  parser.bind('else_', () => computedNodeBody),
  parser.range(({ if_, then_, else_ }) => ({
    type: 'IfThenElse',
    if: if_,
    then: then_,
    else: else_,
  })),
);

export const paren: Parser<Paren> = pipe(
  parser.unit,
  parser.left(char('(')),
  parser.left(whitespaces),
  parser.bind('expr', () => expr),
  parser.left(whitespaces),
  parser.left(char(')')),
  parser.range(({ expr }) => ({ type: 'Paren', expr })),
);

export const expr: Parser<Expr> = pipe(
  ifThenElse,
  parser.or<Expr>(agentDef),
  parser.or<Expr>(operator),
);

export const modifier: Parser<Modifier> = pipe(
  text('public'),
  parser.or(text('private')),
  parser.range(_ => ({ type: 'Modifier', value: _ === 'public' ? 'public' : 'private' })),
);

export const staticNode: Parser<StaticNode> = pipe(
  parser.unit,
  parser.bind('modifiers', () =>
    pipe(
      modifier,
      parser.left(whitespaces1),
      parser.optional,
      parser.map(
        option.match(
          () => [],
          _ => [_],
        ),
      ),
    ),
  ),
  parser.left(text('static')),
  parser.left(whitespaces1),
  parser.bind('name', () => identifier),
  parser.left(whitespaces),
  parser.left(char('=')),
  parser.left(whitespaces),
  parser.bind('value', () => expr),
  parser.left(whitespaces),
  parser.left(char(';')),
  parser.range(({ name, modifiers, value }) => ({
    type: 'StaticNode',
    modifiers,
    name,
    value,
  })),
);

export const nestedGraph: Parser<NestedGraph> = pipe(
  parser.unit,
  parser.left(char('{')),
  parser.left(whitespaces),
  parser.bind('graph', () =>
    graph(
      pipe(
        whitespaces,
        parser.left(char('}')),
        parser.map(() => unit),
      ),
      option.none,
    ),
  ),
  parser.range(({ graph }) =>
    identity<Omit<NestedGraph, 'context'>>({
      type: 'NestedGraph',
      graph,
    }),
  ),
);

export const computedNodeBody: Parser<ComputedNodeBody> = pipe(
  nestedGraph,
  parser.or<ComputedNodeBody>(expr),
);

export const anonComputedNode: Parser<ComputedNode> = pipe(
  parser.unit,
  parser.bind('body', () => computedNodeBody),
  parser.left(whitespaces),
  parser.left(char(';')),
  parser.range(({ body }) => pipe({ type: 'ComputedNode', modifiers: [], body })),
);

export const namedComputedNode: Parser<ComputedNode> = pipe(
  parser.unit,
  parser.bind('modifiers', () =>
    pipe(
      modifier,
      parser.left(whitespaces1),
      parser.optional,
      parser.map(
        option.match(
          () => [],
          _ => [_],
        ),
      ),
    ),
  ),
  parser.bind('name', () =>
    pipe(
      nodeIdentifier,
      parser.left(whitespaces),
      parser.left(char('=')),
      parser.left(whitespaces),
    ),
  ),
  parser.bind('body', () => computedNodeBody),
  parser.left(whitespaces),
  parser.left(char(';')),
  parser.range(({ name, modifiers, body }) =>
    pipe({ type: 'ComputedNode', modifiers, name, body }),
  ),
);

export const computedNode: Parser<ComputedNode> = pipe(
  namedComputedNode,
  parser.or(anonComputedNode),
);

export const statement: Parser<Node> = pipe(staticNode, parser.or<Node>(computedNode));

type GraphResult = [Statements, error.ParserError | 'next' | 'stop'];
export const graph = (end: Parser<Unit>, version: Option<string>): Parser<Graph> =>
  pipe(
    parser.repeat<GraphResult>([[], 'next'], ([xs, flag]) =>
      flag === 'next'
        ? pipe(
            statement,
            parser.left(whitespaces),
            parser.map(x => identity<GraphResult>([[...xs, x], 'next'])),
            parser.orElse(e =>
              pipe(
                end,
                parser.map(() => identity<GraphResult>([xs, 'stop'])),
                parser.orElse(() => parser.of<GraphResult>([xs, e])),
              ),
            ),
          )
        : flag === 'stop'
          ? parser.fail({
              type: 'UnexpectedParserError',
              message: 'Stop signal',
            })
          : parser.fail(flag),
    ),
    parser.flatMap(([statements, flag]) =>
      flag === 'next' || flag === 'stop'
        ? statements.length === 0
          ? parser.fail<Graph['statements']>({
              type: 'UnexpectedParserError',
              message: 'Graph must have at least one statement',
            })
          : parser.of(statements)
        : parser.fail<Graph['statements']>(flag),
    ),
    parser.range(statements =>
      identity<Omit<Graph, 'context'>>({
        type: 'Graph',
        version: option.toUndefined(version),
        statements,
      }),
    ),
  );

export const version: Parser<string> = pipe(
  text('@version('),
  parser.right(whitespaces),
  parser.right(string),
  parser.left(whitespaces),
  parser.left(char(')')),
  parser.left(whitespaces),
  parser.left(char(';')),
  parser.flatMap(_ =>
    typeof _.value[0] === 'string'
      ? parser.of(_.value[0])
      : parser.fail({
          type: 'UnexpectedParserError',
          message: 'Version annotation must be a string',
        }),
  ),
);

export const import_: Parser<Import | NativeImport> = pipe(
  parser.unit,
  parser.bind('isNative', () =>
    pipe(
      text('native'),
      parser.left(whitespaces1),
      parser.optional,
      parser.map(
        option.match(
          () => false,
          () => true,
        ),
      ),
    ),
  ),
  parser.left(text('import')),
  parser.left(whitespaces1),
  parser.bind('path', () =>
    pipe(
      string,
      parser.flatMap(_ =>
        _.value.length === 1 && typeof _.value[0] === 'string'
          ? parser.of<string>(_.value[0])
          : parser.fail<string>({
              type: 'UnexpectedParserError',
              message: 'Import path must be a string',
            }),
      ),
    ),
  ),
  parser.bind('name', () =>
    pipe(
      whitespaces1,
      parser.right(text('as')),
      parser.right(whitespaces1),
      parser.right(identifier),
      parser.optional,
    ),
  ),
  parser.left(whitespaces),
  parser.left(char(';')),
  parser.tap(({ isNative, name }) =>
    isNative === true
      ? pipe(
          name,
          option.match(
            () =>
              parser.fail({
                type: 'UnexpectedParserError',
                message: 'Native import must have an alias',
              }),
            () => parser.of(unit),
          ),
        )
      : parser.of(unit),
  ),
  parser.range(({ isNative, path, name }) =>
    isNative === true
      ? identity<Omit<NativeImport, 'context'>>({
          type: 'NativeImport',
          path,
          as: option.toUndefined(name) as Identifier,
        })
      : identity<Omit<Import, 'context'>>({ type: 'Import', path, as: option.toUndefined(name) }),
  ),
);

export const imports: Parser<ReadonlyArray<Import | NativeImport>> = pipe(
  import_,
  parser.sepBy(whitespaces),
);

export const file = (path: string): Parser<File> =>
  pipe(
    whitespaces,
    parser.bind('version', () => pipe(version, parser.optional)),
    parser.left(whitespaces),
    parser.bind('imports', () => imports),
    parser.left(whitespaces),
    parser.bind('graph', ({ version }) =>
      graph(
        pipe(
          whitespaces,
          parser.left(eos),
          parser.map(() => unit),
        ),
        version,
      ),
    ),
    parser.range(({ imports, graph }) => ({ type: 'File', path, imports, graph })),
  );
