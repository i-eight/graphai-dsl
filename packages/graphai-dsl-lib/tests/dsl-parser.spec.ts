import { pipe } from 'fp-ts/lib/function';
import {
  call,
  agentDef,
  array,
  boolean,
  computedNode,
  expr,
  file,
  identifier,
  ifThenElse,
  logical,
  mulDivMod,
  nodeAnnotation,
  null_,
  number,
  object,
  paren,
  plusMinus,
  power,
  staticNode,
  string,
  equality,
  relational,
  pipeline,
} from '../src/lib/dsl-parser';
import { parser } from '../src/lib/parser-combinator';
import { stream } from '../src/lib/stream';
import { printJson, toTupleFromExpr } from './helpers';
import { either } from 'fp-ts';
import { Expr } from '../src/lib/dsl-syntax-tree';

describe('dsl-parser', () => {
  test('identifier', () => {
    pipe(
      identifier,
      parser.run(stream.fromData('abc_123')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right('abc_123')),
    );

    pipe(
      identifier,
      parser.run(stream.fromData('abc-123')),
      either.map(_ => _.data.name),
      _ => expect(_).toEqual(either.right('abc')),
    );

    pipe(identifier, parser.run(stream.fromData('123_abc')), _ =>
      either.left({
        type: 'UnexpectedParserError',
        expect: 'identifier',
        actual: '1',
        message: 'An identifier can not start with 1',
        position: {
          index: 0,
          row: 1,
          column: 1,
        },
      }),
    );

    pipe(identifier, parser.run(stream.fromData('static')), _ =>
      either.left({
        type: 'MessageParserError',
        message: "Cannot use 'static' as an identifier",
        position: {
          index: 6,
          row: 1,
          column: 7,
        },
      }),
    );
  });

  test('boolean', () => {
    pipe(
      boolean,
      parser.run(stream.fromData('true')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(true)),
    );

    pipe(
      boolean,
      parser.run(stream.fromData('false')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(false)),
    );
  });

  test('number 1', () =>
    pipe(
      number,
      parser.run(stream.fromData('123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(123)),
    ));

  test('number 2', () =>
    pipe(
      number,
      parser.run(stream.fromData('+123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(123)),
    ));

  test('number 3', () =>
    pipe(
      number,
      parser.run(stream.fromData('-123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(-123)),
    ));

  test('number 4', () =>
    pipe(
      number,
      parser.run(stream.fromData('123.456')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(123.456)),
    ));

  test('number 5', () =>
    pipe(
      number,
      parser.run(stream.fromData('0.123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(0.123)),
    ));

  test('number 6', () =>
    pipe(
      number,
      parser.run(stream.fromData('-0.123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(-0.123)),
    ));

  test('number 7', () =>
    pipe(
      number,
      parser.run(stream.fromData('')),
      either.map(_ => _.data.value),
      _ =>
        expect(_).toEqual(
          either.left({
            type: 'UnexpectedParserError',
            expect: 'number',
            actual: '?',
            source: { data: '', path: '' },
            position: { index: 0, row: 1, column: 1 },
          }),
        ),
    ));

  test('null', () => {
    pipe(
      null_,
      parser.run(stream.fromData('null')),
      either.map(_ => _.data.type),
      _ => expect(_).toStrictEqual(either.right('Null')),
    );
  });

  test('string', () => {
    pipe(
      string,
      parser.run(stream.fromData("'abc'")),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right(['abc'])),
    );

    pipe(
      string,
      parser.run(stream.fromData('"abc"')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right(['abc'])),
    );

    pipe(
      string,
      parser.run(stream.fromData('""')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right([])),
    );

    pipe(
      string,
      parser.run(stream.fromData('"abc\\$def"')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right(['abc$def'])),
    );

    pipe(
      string,
      parser.run(stream.fromData('"abc\\"def"')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right(['abc"def'])),
    );

    pipe(
      string,
      parser.run(stream.fromData('"abc ${1} def"')),
      either.map(_ =>
        _.data.value.map(_ => (typeof _ === 'string' ? _ : _.type === 'Number' ? _.value : _)),
      ),
      _ => expect(_).toStrictEqual(either.right(['abc ', 1, ' def'])),
    );
  });

  test('array', () => {
    pipe(
      array,
      parser.run(stream.fromData('[1, 2, 3]')),
      either.map(_ => _.data.value.map(_ => (_.type === 'Number' ? _.value : _))),
      _ => expect(_).toStrictEqual(either.right([1, 2, 3])),
    );

    pipe(
      array,
      parser.run(stream.fromData('[ 1 , 2 , 3 , ]')),
      either.map(_ => _.data.value.map(_ => (_.type === 'Number' ? _.value : _))),
      _ => expect(_).toStrictEqual(either.right([1, 2, 3])),
    );

    pipe(
      array,
      parser.run(stream.fromData('[]')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right([])),
    );
  });

  test('object', () => {
    pipe(
      object,
      parser.run(stream.fromData('{ a: 1, b: 2, c: 3 }')),
      either.map(_ =>
        _.data.value.map(_ => ({
          key: _.key.name,
          value: _.value.type === 'Number' ? _.value.value : _.value,
        })),
      ),
      _ =>
        expect(_).toStrictEqual(
          either.right([
            { key: 'a', value: 1 },
            { key: 'b', value: 2 },
            { key: 'c', value: 3 },
          ]),
        ),
    );

    pipe(
      object,
      parser.run(stream.fromData('{ }')),
      either.map(_ =>
        _.data.value.map(_ => ({
          key: _.key.name,
          value: _.value.type === 'Number' ? _.value.value : _.value,
        })),
      ),
      _ => expect(_).toStrictEqual(either.right([])),
    );
  });

  test('array-at 1', () =>
    pipe(
      call,
      parser.run(stream.fromData('abc[1]')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right({ array: 'abc', at: 1 })),
    ));

  test('array-at 1', () =>
    pipe(
      call,
      parser.run(stream.fromData('[1, 2, 3][1]')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right({ array: [1, 2, 3], at: 1 })),
    ));

  test('object-member 1', () =>
    pipe(
      call,
      parser.run(stream.fromData('abc.key')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right({ object: 'abc', member: 'key' })),
    ));

  test('object-member 2', () =>
    pipe(
      call,
      parser.run(stream.fromData('{ a: 1 }.key')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right({ object: { a: 1 }, member: 'key' })),
    ));

  test('node-annotation', () => {
    pipe(
      nodeAnnotation,
      parser.run(stream.fromData('@abc(123)')),
      either.map(_ => [_.data.name.name, _.data.value.type === 'Number' ? _.data.value.value : _]),
      _ => expect(_).toStrictEqual(either.right(['abc', 123])),
    );

    pipe(
      nodeAnnotation,
      parser.run(stream.fromData('@isResult(true)')),
      either.map(_ => [_.data.name.name, _.data.value.type === 'Boolean' ? _.data.value.value : _]),
      _ => expect(_).toStrictEqual(either.right(['isResult', true])),
    );
  });

  test('agent-call 1', () =>
    pipe(
      call,
      parser.run(stream.fromData('someAgent(hoge)')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            agent: 'someAgent',
            annotations: [],
            args: 'hoge',
          }),
        ),
    ));

  test('agent-call 2', () =>
    pipe(
      call,
      parser.run(stream.fromData('someAgent({a: 1, b: 2})')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            agent: 'someAgent',
            annotations: [],
            args: { a: 1, b: 2 },
          }),
        ),
    ));

  test('agent-call 3', () =>
    pipe(
      call,
      parser.run(stream.fromData('someAgent({a: 1, b: 2})({c: 3})')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            annotations: [],
            agent: {
              annotations: [],
              agent: 'someAgent',
              args: {
                a: 1,
                b: 2,
              },
            },
            args: {
              c: 3,
            },
          }),
        ),
    ));

  test('annotated-agent-call 1', () =>
    pipe(
      call,
      parser.run(stream.fromData('@abc(123) someAgent(hoge)')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            annotations: [{ annotation: 'abc', value: 123 }],
            agent: 'someAgent',
            args: 'hoge',
          }),
        ),
    ));

  test('annotated-agent-call 2', () =>
    pipe(
      call,
      parser.run(
        stream.fromData('@abc(123) @console({after: true}) @isResult(true) someAgent(hoge)'),
      ),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            annotations: [
              { annotation: 'abc', value: 123 },
              { annotation: 'console', value: { after: true } },
              { annotation: 'isResult', value: true },
            ],
            agent: 'someAgent',
            args: 'hoge',
          }),
        ),
    ));

  test('call 1', () =>
    pipe(
      call,
      parser.run(stream.fromData('someAgent({a: 1, b: 2})[0].key')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            object: {
              array: {
                annotations: [],
                agent: 'someAgent',
                args: {
                  a: 1,
                  b: 2,
                },
              },
              at: 0,
            },
            member: 'key',
          }),
        ),
    ));

  test('agent-def 1', () => {
    pipe(
      agentDef,
      parser.run(stream.fromData('(args) -> args.a')),
      either.map(_ => [_.data.args?.name, toTupleFromExpr(_.data.body as Expr)]),
      _ => expect(_).toStrictEqual(either.right(['args', { object: 'args', member: 'a' }])),
    );
  });

  test('agent-def 2', () => {
    pipe(
      agentDef,
      parser.run(stream.fromData('(a, b) -> a + b')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            def: 'a',
            body: {
              def: 'b',
              body: ['a', '+', 'b'],
            },
          }),
        ),
    );
  });

  test('power 1', () => {
    pipe(
      power,
      parser.run(stream.fromData('2 ^ 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '^', 3])),
    );
  });

  test('mult-div-mod 1', () => {
    pipe(
      mulDivMod,
      parser.run(stream.fromData('2 * 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '*', 3])),
    );
  });

  test('mult-div-mod 2', () => {
    pipe(
      mulDivMod,
      parser.run(stream.fromData('2 / 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '/', 3])),
    );
  });

  test('mult-div-mod 3', () => {
    pipe(
      mulDivMod,
      parser.run(stream.fromData('2 % 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '%', 3])),
    );
  });

  test('mult-div-mod 4', () => {
    pipe(
      mulDivMod,
      parser.run(stream.fromData('2 * 3 / 4 % 5')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[[2, '*', 3], '/', 4], '%', 5])),
    );
  });

  test('mult-div-mod 5', () => {
    pipe(
      mulDivMod,
      parser.run(stream.fromData('1 ^ 2 * 3 ^ 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[1, '^', 2], '*', [3, '^', 4]])),
    );
  });

  test('mult-div-mod 6', () => {
    pipe(
      mulDivMod,
      parser.run(stream.fromData('1 * 2 ^ 3 / 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[1, '*', [2, '^', 3]], '/', 4])),
    );
  });

  test('plus-minus 1', () => {
    pipe(
      plusMinus,
      parser.run(stream.fromData('2 + 3 - 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[2, '+', 3], '-', 4])),
    );
  });

  test('plus-minus 2', () => {
    pipe(
      plusMinus,
      parser.run(stream.fromData('1 + 2 * 3 ^ 4 - 5 / 6')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(either.right([[1, '+', [2, '*', [3, '^', 4]]], '-', [5, '/', 6]])),
    );
  });

  test('equality 1', () => {
    pipe(
      equality,
      parser.run(stream.fromData('2 == 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '==', 3])),
    );
  });

  test('equality 2', () => {
    pipe(
      equality,
      parser.run(stream.fromData('2 != 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '!=', 3])),
    );
  });

  test('relational 3', () => {
    pipe(
      relational,
      parser.run(stream.fromData('2 > 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '>', 3])),
    );
  });

  test('relational 4', () => {
    pipe(
      relational,
      parser.run(stream.fromData('2 >= 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '>=', 3])),
    );
  });

  test('relational 5', () => {
    pipe(
      relational,
      parser.run(stream.fromData('2 < 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '<', 3])),
    );
  });

  test('relational 6', () => {
    pipe(
      relational,
      parser.run(stream.fromData('2 <= 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '<=', 3])),
    );
  });

  test('relational 7', () => {
    pipe(
      relational,
      parser.run(stream.fromData('1 + 2 <= 3 * 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[1, '+', 2], '<=', [3, '*', 4]])),
    );
  });

  test('logical 1', () => {
    pipe(
      logical,
      parser.run(stream.fromData('true && false')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([true, '&&', false])),
    );
  });

  test('logical 2', () => {
    pipe(
      logical,
      parser.run(stream.fromData('true || false')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([true, '||', false])),
    );
  });

  test('logical 3', () => {
    pipe(
      logical,
      parser.run(stream.fromData('1 > 2 && 3 < 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[1, '>', 2], '&&', [3, '<', 4]])),
    );
  });

  test('pipeline 1', () => {
    pipe(
      pipeline,
      parser.run(stream.fromData('a |> f1')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right(['a', '|>', 'f1'])),
    );
  });

  test('pipeline 2', () => {
    pipe(
      pipeline,
      parser.run(stream.fromData('a |> f1 --> f2 >>= f3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[['a', '|>', 'f1'], '-->', 'f2'], '>>=', 'f3'])),
    );
  });

  test('pipeline 3', () => {
    pipe(
      pipeline,
      parser.run(stream.fromData('a + b |> ((_) -> f1(_)) --> f2')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right([
            [
              ['a', '+', 'b'],
              '|>',
              [
                {
                  def: '_',
                  body: {
                    annotations: [],
                    agent: 'f1',
                    args: '_',
                  },
                },
              ],
            ],
            '-->',
            'f2',
          ]),
        ),
    );
  });

  test('pipeline 4', () => {
    pipe(
      pipeline,
      parser.run(stream.fromData('a + b |> ((_) -> f1(_) --> f2)')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right([
            ['a', '+', 'b'],
            '|>',
            [
              {
                def: '_',
                body: [
                  {
                    annotations: [],
                    agent: 'f1',
                    args: '_',
                  },
                  '-->',
                  'f2',
                ],
              },
            ],
          ]),
        ),
    );
  });

  test('pipeline 5', () => {
    pipe(
      pipeline,
      parser.run(stream.fromData('a + b |> (_) -> _ * 2')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right([
            ['a', '+', 'b'],
            '|>',
            {
              def: '_',
              body: ['_', '*', 2],
            },
          ]),
        ),
    );
  });

  test('pipeline 6', () => {
    pipe(
      pipeline,
      parser.run(stream.fromData('a + b |> (_) -> _ |> f')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right([
            ['a', '+', 'b'],
            '|>',
            {
              def: '_',
              body: ['_', '|>', 'f'],
            },
          ]),
        ),
    );
  });

  test('pipeline 7', () => {
    pipe(
      pipeline,
      parser.run(stream.fromData('a + b |> f1 |> (_) -> _ |> f2')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right([
            [['a', '+', 'b'], '|>', 'f1'],
            '|>',
            {
              def: '_',
              body: ['_', '|>', 'f2'],
            },
          ]),
        ),
    );
  });

  test('pipeline 8', () => {
    pipe(
      pipeline,
      parser.run(stream.fromData('a + b |> if flag then f1 else f2')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right([
            ['a', '+', 'b'],
            '|>',
            {
              if: 'flag',
              then: 'f1',
              else: 'f2',
            },
          ]),
        ),
    );
  });

  test('if-then-else 1', () => {
    pipe(
      ifThenElse,
      parser.run(stream.fromData('if a then b else c')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            if: 'a',
            then: 'b',
            else: 'c',
          }),
        ),
    );
  });

  test('if-then-else 2', () => {
    pipe(
      ifThenElse,
      parser.run(stream.fromData('if flag1 then a else if flag2 then b else c')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            if: 'flag1',
            then: 'a',
            else: {
              if: 'flag2',
              then: 'b',
              else: 'c',
            },
          }),
        ),
    );
  });

  test('if-then-else 3', () => {
    pipe(
      ifThenElse,
      parser.run(stream.fromData('if a then println({message: 1}) else println({message: 2})')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            if: 'a',
            then: {
              annotations: [],
              agent: 'println',
              args: {
                message: 1,
              },
            },
            else: {
              annotations: [],
              agent: 'println',
              args: {
                message: 2,
              },
            },
          }),
        ),
    );
  });

  test('if-then-else 4', () => {
    pipe(
      ifThenElse,
      parser.run(
        stream.fromData('if a then { println({message: 1}); } else { println({message: 2}); }'),
      ),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            if: 'a',
            then: {
              annotations: [],
              nested: [
                {
                  anonNode: {
                    annotations: [],
                    agent: 'println',
                    args: {
                      message: 1,
                    },
                  },
                },
              ],
            },
            else: {
              annotations: [],
              nested: [
                {
                  anonNode: {
                    annotations: [],
                    agent: 'println',
                    args: {
                      message: 2,
                    },
                  },
                },
              ],
            },
          }),
        ),
    );
  });

  test('paren 1', () => {
    pipe(
      paren,
      parser.run(stream.fromData('(1)')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([1])),
    );
  });

  test('paren 2', () => {
    pipe(
      paren,
      parser.run(stream.fromData('((1 + 2) * 3)')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[[[1, '+', 2]], '*', 3]])),
    );
  });

  test('expr 1', () => {
    pipe(
      expr,
      parser.run(stream.fromData('a + 1 > b * 2')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([['a', '+', 1], '>', ['b', '*', 2]])),
    );
  });

  test('expr 2', () => {
    pipe(
      expr,
      parser.run(
        stream.fromData('if flag then agent({inputs: {a: 1, b: 2}}) else print("flag is false")'),
      ),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            if: 'flag',
            then: {
              annotations: [],
              agent: 'agent',
              args: {
                inputs: {
                  a: 1,
                  b: 2,
                },
              },
            },
            else: {
              annotations: [],
              agent: 'print',
              args: ['flag is false'],
            },
          }),
        ),
    );
  });

  test('expr 3', () => {
    pipe(
      call,
      parser.run(
        stream.fromData(`loop({
          init: {cnt: 0}, 
          callback: (args) ->
            if args.cnt < 10
            then recur({cnt: args.cnt + 1})
            else args.cnt
        })`),
      ),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            annotations: [],
            agent: 'loop',
            args: {
              init: {
                cnt: 0,
              },
              callback: {
                def: 'args',
                body: {
                  if: [
                    {
                      object: 'args',
                      member: 'cnt',
                    },
                    '<',
                    10,
                  ],
                  then: {
                    annotations: [],
                    agent: 'recur',
                    args: {
                      cnt: [
                        {
                          object: 'args',
                          member: 'cnt',
                        },
                        '+',
                        1,
                      ],
                    },
                  },
                  else: {
                    object: 'args',
                    member: 'cnt',
                  },
                },
              },
            },
          }),
        ),
    );
  });

  test('static-node 1', () => {
    pipe(
      staticNode,
      parser.run(stream.fromData('static abc = 123;')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            staticNode: 'abc',
            value: 123,
          }),
        ),
    );
  });

  test('computed-node 1', () => {
    pipe(
      computedNode,
      parser.run(
        stream.fromData('abc = @isResult(true) @console({after: true}) agent({inputs: "hoge"});'),
      ),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            computedNode: 'abc',
            body: {
              annotations: [
                {
                  annotation: 'isResult',
                  value: true,
                },
                {
                  annotation: 'console',
                  value: {
                    after: true,
                  },
                },
              ],
              agent: 'agent',
              args: {
                inputs: ['hoge'],
              },
            },
          }),
        ),
    );
  });

  test('computed-node 2', () => {
    pipe(
      computedNode,
      parser.run(
        stream.fromData(`abc = @isResult(true) @console({after: true}) { 
          node1 = agent1({inputs: "hoge"});
          agent2({inputs: node1});
        };`),
      ),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            computedNode: 'abc',
            body: {
              annotations: [
                {
                  annotation: 'isResult',
                  value: true,
                },
                {
                  annotation: 'console',
                  value: {
                    after: true,
                  },
                },
              ],
              nested: [
                {
                  computedNode: 'node1',
                  body: {
                    annotations: [],
                    agent: 'agent1',
                    args: {
                      inputs: ['hoge'],
                    },
                  },
                },
                {
                  anonNode: {
                    annotations: [],
                    agent: 'agent2',
                    args: {
                      inputs: 'node1',
                    },
                  },
                },
              ],
            },
          }),
        ),
    );
  });

  test('computed-node 3', () => {
    pipe(
      computedNode,
      parser.run(stream.fromData('abc = null;')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            computedNode: 'abc',
            body: null,
          }),
        ),
    );
  });

  test('file 1', () => {
    pipe(
      file(''),
      parser.run(
        stream.fromData(`
          static node1 = 123;
          node2 = @isResult(true) @console({after: true}) agent({inputs: "hoge"});
          { 
            node4 = agent1({inputs: "hoge"});
            agent2({inputs: node1});
          };
        `),
      ),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            imports: [],
            graph: [
              {
                staticNode: 'node1',
                value: 123,
              },
              {
                computedNode: 'node2',
                body: {
                  annotations: [
                    {
                      annotation: 'isResult',
                      value: true,
                    },
                    {
                      annotation: 'console',
                      value: {
                        after: true,
                      },
                    },
                  ],
                  agent: 'agent',
                  args: {
                    inputs: ['hoge'],
                  },
                },
              },
              {
                anonNode: {
                  annotations: [],
                  nested: [
                    {
                      computedNode: 'node4',
                      body: {
                        annotations: [],
                        agent: 'agent1',
                        args: {
                          inputs: ['hoge'],
                        },
                      },
                    },
                    {
                      anonNode: {
                        annotations: [],
                        agent: 'agent2',
                        args: {
                          inputs: 'node1',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          }),
        ),
    );
  });
});
