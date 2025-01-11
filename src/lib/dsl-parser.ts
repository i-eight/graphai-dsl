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
  AgentDef,
  ArrayAt,
  BlockComment,
  Compare,
  ComputedNode,
  ComputedNodeBody,
  ComputedNodeBodyExpr,
  ComputedNodeBodyParen,
  DSLArray,
  DSLBoolean,
  DSLNull,
  DSLNumber,
  DSLObject,
  DSLString,
  Expr,
  Graph,
  Identifier,
  IfThenElse,
  LineComment,
  Logical,
  MulDivMod,
  NestedGraph,
  Node,
  NodeAnnotation,
  ObjectMember,
  Paren,
  PlusMinus,
  Power,
  PowerBase,
  StaticNode,
  TermCompare,
  TermLogical,
  TermMulDivMod,
  TermPlusMinus,
} from './dsl-syntax-tree';
import { error, Parser, parser } from './parser-combinator';
import { option, readonlyArray } from 'fp-ts';
import os from 'os';
import { unit } from './unit';

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
    pipe(
      parser.notFollowedBy(text('*/')),
      parser.right(anyChar),
      parser.repeat('', (a, s) => a + s),
    ),
  ),
  parser.left(text('*/')),
  parser.context(value => ({ type: 'BlockComment', value })),
);

export const lineComment: Parser<LineComment> = pipe(
  text('//'),
  parser.right(
    pipe(
      parser.notFollowedBy(
        pipe(
          text(os.EOL),
          parser.map(_ => unit),
          parser.or(eos),
        ),
      ),
      parser.right(anyChar),
      parser.repeat('', (a, s) => a + s),
    ),
  ),
  parser.left(
    pipe(
      text(os.EOL),
      parser.map(_ => unit),
      parser.or(eos),
    ),
  ),
  parser.context(value => ({ type: 'LineComment', value })),
);

export const ignoredToken: Parser<ReadonlyArray<BlockComment | LineComment>> = pipe(
  whitespace,
  parser.or<string | BlockComment | LineComment>(blockComment),
  parser.or<string | BlockComment | LineComment>(lineComment),
  parser.map(_ => (typeof _ === 'string' ? [] : [_])),
);

export const whitespaces: Parser<ReadonlyArray<BlockComment | LineComment>> = pipe(
  ignoredToken,
  parser.repeat([] as ReadonlyArray<BlockComment | LineComment>, (xs, s) => [...xs, ...s]),
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
  parser.bind('annotations', () => nodeAnnotations),
  parser.bind('first', () => pipe(alphabet, parser.or(underScore))),
  parser.orElse(e =>
    parser.fail({
      type: 'UnexpectedError',
      expect: 'identifier',
      actual: error.getActual(e),
      message: `An identifier can not start with ${error.getActual(e)}`,
    }),
  ),
  parser.bind('rest', () =>
    pipe(
      alphaNum,
      parser.or(underScore),
      parser.repeat('', (a, s) => a + s),
    ),
  ),
  parser.bind('name', ({ first, rest }) => parser.of(first + rest)),
  parser.bind('_', ({ name }) =>
    pipe(
      reservedWords,
      readonlyArray.exists(_ => _ === name),
      _ =>
        _
          ? parser.fail<string>({
              type: 'MessageError',
              message: `Cannot use '${name}' as an identifier`,
            })
          : parser.of(name),
    ),
  ),
  parser.context(({ name, annotations }) => ({ type: 'Identifier', annotations, name })),
);

export const boolean: Parser<DSLBoolean> = pipe(
  text('true'),
  parser.or(text('false')),
  parser.orElse(e =>
    parser.fail({ type: 'UnexpectedError', expect: 'boolean', actual: error.getActual(e) }),
  ),
  parser.context(_ => ({ type: 'Boolean', value: _ === 'true' })),
);

export const unsignedInteger: Parser<string> = pipe(
  digit,
  parser.repeat1('', (a, s) => a + s),
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
  parser.map(({ sign, uint, decimal }) => Number(`${sign}${uint}${decimal}`)),
  parser.orElse(e =>
    parser.fail({ type: 'UnexpectedError', expect: 'number', actual: error.getActual(e) }),
  ),
  parser.context(value => ({ type: 'Number', value })),
);

const stringQuote = (quote: '"' | "'"): Parser<DSLString> =>
  pipe(
    char(quote),
    parser.right(
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
        parser.repeat1<string, string | Expr>('', (a, s) => a + s),
        parser.or<string | Expr>(
          pipe(
            text('${'),
            parser.right(whitespaces),
            parser.flatMap(() => expr),
            parser.left(whitespaces),
            parser.left(char('}')),
          ),
        ),
        parser.repeat<string | Expr, ReadonlyArray<string | Expr>>([], (xs, x) => [...xs, x]),
      ),
    ),
    parser.left(char(quote)),
    parser.context(value => ({ type: 'String', value })),
  );

export const string: Parser<DSLString> = pipe(stringQuote('"'), parser.or(stringQuote("'")));

export const array: Parser<DSLArray> = pipe(
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
  parser.context(value => ({ type: 'Array', value })),
);

export const object: Parser<DSLObject> = pipe(
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
  parser.context(value => ({ type: 'Object', value })),
);

export const null_: Parser<DSLNull> = pipe(
  text('null'),
  parser.context(_ => ({ type: 'Null' })),
);

type ArrayType = ArrayAt['array'];
export const arrayAt: Parser<ArrayAt> = pipe(
  parser.unit,
  parser.bind('annotations', () => nodeAnnotations),
  parser.bind('array', () =>
    pipe(
      paren as Parser<ArrayType>,
      parser.or<ArrayType>(array),
      parser.or<ArrayType>(identifier),
      parser.or<ArrayType>(agentCall),
    ),
  ),
  parser.left(char('[')),
  parser.left(whitespaces),
  parser.bind('index', () => expr),
  parser.left(whitespaces),
  parser.left(char(']')),
  parser.context(({ annotations, array, index }) => ({
    type: 'ArrayAt',
    annotations,
    array,
    index,
  })),
);

type ObjectType = ObjectMember['object'];
export const objectMember: Parser<ObjectMember> = pipe(
  parser.unit,
  parser.bind('annotations', () => nodeAnnotations),
  parser.bind('object', () =>
    pipe(
      paren as Parser<ObjectType>,
      parser.or<ObjectType>(object),
      parser.or<ObjectType>(identifier),
      parser.or<ObjectType>(agentCall),
    ),
  ),
  parser.left(whitespaces),
  parser.left(char('.')),
  parser.left(whitespaces),
  parser.bind('key', () => identifier),
  parser.context(({ annotations, object, key }) => ({
    type: 'ObjectMember',
    annotations,
    object,
    key,
  })),
);

export const nodeAnnotation: Parser<NodeAnnotation> = pipe(
  char('@'),
  parser.bind('name', () => identifier),
  parser.left(char('(')),
  parser.left(whitespaces),
  parser.bind('value', () => expr),
  parser.left(whitespaces),
  parser.left(char(')')),
  parser.context(({ name, value }) => ({ type: 'NodeAnnotation', name, value })),
);

export const nodeAnnotations: Parser<ReadonlyArray<NodeAnnotation>> = pipe(
  nodeAnnotation,
  parser.sepBy1(whitespaces1),
  parser.left(whitespaces1),
  parser.or(parser.of<ReadonlyArray<NodeAnnotation>>([])),
);

export const agentCall: Parser<AgentCall> = pipe(
  parser.unit,
  parser.bind('annotations', () => nodeAnnotations),
  parser.bind('agent', () => identifier),
  parser.left(char('(')),
  parser.left(whitespaces),
  parser.bind('args', () => pipe(expr, parser.optional)),
  parser.left(whitespaces),
  parser.left(char(')')),
  parser.context(({ annotations, agent, args }) => ({
    type: 'AgentCall',
    annotations,
    agent,
    args: option.toUndefined(args),
  })),
);

export const agentDef: Parser<AgentDef> = pipe(
  parser.unit,
  parser.bind('annotations', () => nodeAnnotations),
  parser.left(char('(')),
  parser.left(whitespaces),
  parser.bind('args', () => pipe(identifier, parser.optional)),
  parser.left(whitespaces),
  parser.left(char(')')),
  parser.left(whitespaces),
  parser.left(text('->')),
  parser.left(whitespaces),
  parser.bind('body', () =>
    pipe(
      char('{'),
      parser.right(whitespaces),
      parser.flatMap(() => graph),
      parser.left(whitespaces),
      parser.left(char('}')),
      parser.or<Graph | ComputedNodeBodyExpr>(computedNodeBodyExpr),
    ),
  ),
  parser.context(({ annotations, args, body }) => ({
    type: 'AgentDef',
    annotations,
    args: option.toUndefined(args),
    body,
  })),
);

export const powerBase: Parser<PowerBase> = pipe(
  parser.unit,
  parser.flatMap(() => paren),
  parser.or<PowerBase>(arrayAt),
  parser.or<PowerBase>(objectMember),
  parser.or<PowerBase>(agentCall),
  parser.or<PowerBase>(number),
  parser.or<PowerBase>(identifier),
);

export const powerExponent = (base: PowerBase | Power): Parser<Power> =>
  pipe(
    whitespaces,
    parser.right(char('^')),
    parser.right(whitespaces),
    parser.right(number),
    parser.context<DSLNumber, Omit<Power, 'context'>>(exponent => ({
      type: 'Power',
      annotations: [],
      base,
      exponent,
    })),
    parser.flatMap(power => pipe(powerExponent(power), parser.or(parser.of(power)))),
  );

export const powerOr: Parser<PowerBase | Power> = pipe(
  powerBase,
  parser.flatMap(base => pipe(powerExponent(base), parser.or<PowerBase | Power>(parser.of(base)))),
);

export const termMulDivMod: Parser<TermMulDivMod> = powerOr as Parser<TermMulDivMod>;

export const mulDivModRight = (left: TermMulDivMod | MulDivMod): Parser<MulDivMod> =>
  pipe(
    whitespaces,
    parser.bind('operator', () => pipe(char('*'), parser.or(char('/')), parser.or(char('%')))),
    parser.left(whitespaces),
    parser.bind('right', () => termMulDivMod),
    parser.context(({ operator, right }) =>
      identity<Omit<MulDivMod, 'context'>>({
        type: 'MulDivMod',
        annotations: [],
        left,
        operator: operator as '*' | '/' | '%',
        right,
      }),
    ),
    parser.flatMap(mulDivMod => pipe(mulDivModRight(mulDivMod), parser.or(parser.of(mulDivMod)))),
  );

export const mulDivModeOr: Parser<TermMulDivMod | MulDivMod> = pipe(
  termMulDivMod,
  parser.flatMap(left =>
    pipe(mulDivModRight(left), parser.or<TermMulDivMod | MulDivMod>(parser.of(left))),
  ),
);

export const termPlusMinus: Parser<TermPlusMinus> = mulDivModeOr as Parser<TermPlusMinus>;

export const plusMinusRight = (left: TermPlusMinus | PlusMinus): Parser<PlusMinus> =>
  pipe(
    whitespaces,
    parser.bind('operator', () => pipe(char('+'), parser.or(char('-')))),
    parser.left(whitespaces),
    parser.bind('right', () => termPlusMinus),
    parser.context(({ operator, right }) =>
      identity<Omit<PlusMinus, 'context'>>({
        type: 'PlusMinus',
        annotations: [],
        left,
        operator: operator as '+' | '-',
        right,
      }),
    ),
    parser.flatMap(plusMinus => pipe(plusMinusRight(plusMinus), parser.or(parser.of(plusMinus)))),
  );

export const plusMinusOr: Parser<TermPlusMinus | PlusMinus> = pipe(
  termPlusMinus,
  parser.flatMap(left =>
    pipe(plusMinusRight(left), parser.or<TermPlusMinus | PlusMinus>(parser.of(left))),
  ),
);

export const termCompare: Parser<TermCompare> = pipe(
  plusMinusOr as Parser<TermCompare>,
  parser.or<TermCompare>(boolean),
  parser.or<TermCompare>(string),
  parser.or<TermCompare>(array),
  parser.or<TermCompare>(object),
);

export const compareRight = (left: TermCompare | Compare): Parser<Compare> =>
  pipe(
    whitespaces,
    parser.bind('operator', () =>
      pipe(
        text('=='),
        parser.or(text('!=')),
        parser.or(text('<=')),
        parser.or(text('<')),
        parser.or(text('>=')),
        parser.or(text('>')),
      ),
    ),
    parser.left(whitespaces),
    parser.bind('right', () => termCompare),
    parser.context(({ operator, right }) =>
      identity<Omit<Compare, 'context'>>({
        type: 'Compare',
        annotations: [],
        left,
        operator: operator as '==' | '!=' | '<=' | '<' | '>=' | '>',
        right,
      }),
    ),
    parser.flatMap(compare => pipe(compareRight(compare), parser.or(parser.of(compare)))),
  );

export const compareOr: Parser<TermCompare | Compare> = pipe(
  termCompare,
  parser.flatMap(left =>
    pipe(compareRight(left), parser.or<TermCompare | Compare>(parser.of(left))),
  ),
);

export const termLogical: Parser<TermLogical> = compareOr as Parser<TermLogical>;

export const logicalRight = (left: TermLogical | Logical): Parser<Logical> =>
  pipe(
    whitespaces,
    parser.bind('operator', () => pipe(text('&&'), parser.or(text('||')))),
    parser.left(whitespaces),
    parser.bind('right', () => termLogical),
    parser.context(({ operator, right }) =>
      identity<Omit<Logical, 'context'>>({
        type: 'Logical',
        annotations: [],
        left,
        operator: operator as '&&' | '||',
        right,
      }),
    ),
    parser.flatMap(logical => pipe(logicalRight(logical), parser.or(parser.of(logical)))),
  );

export const logicalOr: Parser<TermLogical | Logical> = pipe(
  termLogical,
  parser.flatMap(left =>
    pipe(logicalRight(left), parser.or<TermLogical | Logical>(parser.of(left))),
  ),
);

export const ifThenElse: Parser<IfThenElse> = pipe(
  parser.unit,
  parser.bind('annotations', () => nodeAnnotations),
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
  parser.context(({ annotations, if_, then_, else_ }) => ({
    type: 'IfThenElse',
    annotations,
    if: if_,
    then: then_,
    else: else_,
  })),
);

export const paren: Parser<Paren> = pipe(
  parser.unit,
  parser.bind('annotations', () => nodeAnnotations),
  parser.left(char('(')),
  parser.left(whitespaces),
  parser.bind('expr', () => expr),
  parser.left(whitespaces),
  parser.left(char(')')),
  parser.context(({ annotations, expr }) => ({ type: 'Paren', annotations, expr })),
);

export const expr: Parser<Expr> = pipe(
  ifThenElse,
  parser.or<Expr>(agentDef),
  parser.or<Expr>(logicalOr),
  parser.or<Expr>(paren),
  parser.or<Expr>(arrayAt),
  parser.or<Expr>(objectMember),
  parser.or<Expr>(agentCall),
  parser.or<Expr>(identifier),
  parser.or<Expr>(boolean),
  parser.or<Expr>(number),
  parser.or<Expr>(null_),
  parser.or<Expr>(string),
  parser.or<Expr>(array),
  parser.or<Expr>(object),
);

export const staticNode: Parser<StaticNode> = pipe(
  text('static'),
  parser.right(whitespaces),
  parser.bind('name', () => identifier),
  parser.left(whitespaces),
  parser.left(char('=')),
  parser.left(whitespaces),
  parser.bind('value', () => expr),
  parser.left(whitespaces),
  parser.left(char(';')),
  parser.context(({ name, value }) => ({ type: 'StaticNode', name, value })),
);

export const computedNodeBodyExpr: Parser<ComputedNodeBodyExpr> = pipe(
  ifThenElse,
  parser.or<ComputedNodeBodyExpr>(agentDef),
  parser.orElse(() => computedNodeBodyParen as Parser<ComputedNodeBodyExpr>),
  parser.or<ComputedNodeBodyExpr>(logicalOr),
  parser.or<ComputedNodeBodyExpr>(arrayAt),
  parser.or<ComputedNodeBodyExpr>(objectMember),
  parser.or<ComputedNodeBodyExpr>(agentCall),
  parser.or<ComputedNodeBodyExpr>(string),
);

export const computedNodeBodyParen: Parser<ComputedNodeBodyParen> = pipe(
  parser.unit,
  parser.bind('annotations', () => nodeAnnotations),
  parser.left(char('(')),
  parser.left(whitespaces),
  parser.bind('expr', () => computedNodeBodyExpr),
  parser.left(whitespaces),
  parser.left(char(')')),
  parser.context(({ annotations, expr }) => ({ type: 'ComputedNodeBodyParen', annotations, expr })),
);

export const nestedGraph: Parser<NestedGraph> = pipe(
  parser.unit,
  parser.bind('annotations', () => nodeAnnotations),
  parser.left(char('{')),
  parser.left(whitespaces),
  parser.bind('graph', () => graph),
  parser.left(whitespaces),
  parser.left(char('}')),
  parser.context(({ annotations, graph }) =>
    identity<Omit<NestedGraph, 'context'>>({
      type: 'NestedGraph',
      annotations,
      graph,
    }),
  ),
);

export const computedNodeBody: Parser<ComputedNodeBody> = pipe(
  nestedGraph,
  parser.or<ComputedNodeBody>(computedNodeBodyExpr),
);

export const computedNode: Parser<ComputedNode> = pipe(
  parser.unit,
  parser.bind('name', () =>
    pipe(
      identifier,
      parser.left(whitespaces),
      parser.left(char('=')),
      parser.left(whitespaces),
      parser.optional,
    ),
  ),
  parser.bind('body', () => computedNodeBody),
  parser.left(whitespaces),
  parser.left(char(';')),
  parser.context(({ name, body }) =>
    pipe(
      name,
      option.match(
        () => ({ type: 'ComputedNode', body }),
        name => ({ type: 'ComputedNode', name, body }),
      ),
    ),
  ),
);

export const graph: Parser<Graph> = pipe(
  staticNode,
  parser.or<Node>(computedNode),
  parser.sepBy1(whitespaces),
  parser.context(statements => ({ type: 'Graph', statements }) as Graph),
);

export const file: Parser<Graph> = pipe(
  whitespaces,
  parser.right(graph),
  parser.left(whitespaces),
  parser.left(eos),
);
