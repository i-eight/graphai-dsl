import { pipe } from 'fp-ts/lib/function';
import {
  agentCall,
  agentDef,
  array,
  arrayAt,
  boolean,
  compareOr,
  computedNode,
  expr,
  file,
  identifier,
  ifThenElse,
  logicalOr,
  mulDivModeOr,
  nodeAnnotation,
  number,
  object,
  objectMember,
  paren,
  plusMinusOr,
  powerOr,
  staticNode,
  string,
} from '../src/lib/dsl-parser';
import { parser } from '../src/lib/parser-combinator';
import { stream } from '../src/lib/stream';
import { toTupleFromExpr } from './helpers';
import { either } from 'fp-ts';
import { Expr } from '../src/lib/dsl-syntax-tree';

describe('dsl-parser', () => {
  test('identifier', () => {
    pipe(identifier, parser.run(stream.create('abc_123')), _ =>
      expect(_).toStrictEqual(
        either.right({
          stream: {
            source: 'abc_123',
            position: {
              index: 7,
              row: 1,
              column: 8,
            },
          },
          data: {
            type: 'Identifier',
            name: 'abc_123',
            annotations: [],
            context: {
              source: 'abc_123',
              start: {
                index: 0,
                row: 1,
                column: 1,
              },
              end: {
                index: 7,
                row: 1,
                column: 8,
              },
            },
          },
        }),
      ),
    );

    pipe(
      identifier,
      parser.run(stream.create('abc-123')),
      either.map(_ => _.data.name),
      _ => expect(_).toEqual(either.right('abc')),
    );

    pipe(identifier, parser.run(stream.create('123_abc')), _ =>
      either.left({
        type: 'UnexpectedError',
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

    pipe(identifier, parser.run(stream.create('static')), _ =>
      either.left({
        type: 'MessageError',
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
      parser.run(stream.create('true')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(true)),
    );

    pipe(
      boolean,
      parser.run(stream.create('false')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(false)),
    );
  });

  test('number', () => {
    pipe(
      number,
      parser.run(stream.create('123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(123)),
    );

    pipe(
      number,
      parser.run(stream.create('+123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(123)),
    );

    pipe(
      number,
      parser.run(stream.create('-123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(-123)),
    );

    pipe(
      number,
      parser.run(stream.create('123.456')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(123.456)),
    );

    pipe(
      number,
      parser.run(stream.create('0.123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(0.123)),
    );

    pipe(
      number,
      parser.run(stream.create('-0.123')),
      either.map(_ => _.data.value),
      _ => expect(_).toEqual(either.right(-0.123)),
    );

    pipe(
      number,
      parser.run(stream.create('')),
      either.map(_ => _.data.value),
      _ =>
        expect(_).toEqual(
          either.left({
            type: 'UnexpectedError',
            expect: 'number',
            actual: '?',
            position: { index: 0, row: 1, column: 1 },
          }),
        ),
    );
  });

  test('string', () => {
    pipe(
      string,
      parser.run(stream.create("'abc'")),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right(['abc'])),
    );

    pipe(
      string,
      parser.run(stream.create('"abc"')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right(['abc'])),
    );

    pipe(
      string,
      parser.run(stream.create('""')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right([])),
    );

    pipe(
      string,
      parser.run(stream.create('"abc\\$def"')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right(['abc$def'])),
    );

    pipe(
      string,
      parser.run(stream.create('"abc\\"def"')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right(['abc"def'])),
    );

    pipe(
      string,
      parser.run(stream.create('"abc ${1} def"')),
      either.map(_ =>
        _.data.value.map(_ => (typeof _ === 'string' ? _ : _.type === 'Number' ? _.value : _)),
      ),
      _ => expect(_).toStrictEqual(either.right(['abc ', 1, ' def'])),
    );
  });

  test('array', () => {
    pipe(
      array,
      parser.run(stream.create('[1, 2, 3]')),
      either.map(_ => _.data.value.map(_ => (_.type === 'Number' ? _.value : _))),
      _ => expect(_).toStrictEqual(either.right([1, 2, 3])),
    );

    pipe(
      array,
      parser.run(stream.create('[ 1 , 2 , 3 , ]')),
      either.map(_ => _.data.value.map(_ => (_.type === 'Number' ? _.value : _))),
      _ => expect(_).toStrictEqual(either.right([1, 2, 3])),
    );

    pipe(
      array,
      parser.run(stream.create('[]')),
      either.map(_ => _.data.value),
      _ => expect(_).toStrictEqual(either.right([])),
    );
  });

  test('object', () => {
    pipe(
      object,
      parser.run(stream.create('{ a: 1, b: 2, c: 3 }')),
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
      parser.run(stream.create('{ }')),
      either.map(_ =>
        _.data.value.map(_ => ({
          key: _.key.name,
          value: _.value.type === 'Number' ? _.value.value : _.value,
        })),
      ),
      _ => expect(_).toStrictEqual(either.right([])),
    );
  });

  test('array-at', () => {
    pipe(
      arrayAt,
      parser.run(stream.create('abc[1]')),
      either.map(_ => [
        _.data.array.type === 'Identifier' ? _.data.array.name : _,
        _.data.index.type === 'Number' ? _.data.index.value : _,
      ]),
      _ => expect(_).toStrictEqual(either.right(['abc', 1])),
    );

    pipe(
      arrayAt,
      parser.run(stream.create('[1, 2, 3][1]')),
      either.map(_ => [
        _.data.array.type === 'Array'
          ? _.data.array.value.map(_ => (_.type === 'Number' ? _.value : _))
          : _,
        _.data.index.type === 'Number' ? _.data.index.value : _,
      ]),
      _ => expect(_).toStrictEqual(either.right([[1, 2, 3], 1])),
    );
  });

  test('object-member', () => {
    pipe(
      objectMember,
      parser.run(stream.create('abc.key')),
      either.map(_ => [
        _.data.object.type === 'Identifier' ? _.data.object.name : _,
        _.data.key.type === 'Identifier' ? _.data.key.name : _,
      ]),
      _ => expect(_).toStrictEqual(either.right(['abc', 'key'])),
    );

    pipe(
      objectMember,
      parser.run(stream.create('{ a: 1 }.key')),
      either.map(_ => [
        _.data.object.type === 'Object'
          ? _.data.object.value.map(_ => ({
              key: _.key.name,
              value: _.value.type === 'Number' ? _.value.value : _,
            }))
          : _,
        _.data.key.type === 'Identifier' ? _.data.key.name : _,
      ]),
      _ => expect(_).toStrictEqual(either.right([[{ key: 'a', value: 1 }], 'key'])),
    );
  });

  test('node-annotation', () => {
    pipe(
      nodeAnnotation,
      parser.run(stream.create('@abc(123)')),
      either.map(_ => [_.data.name.name, _.data.value.type === 'Number' ? _.data.value.value : _]),
      _ => expect(_).toStrictEqual(either.right(['abc', 123])),
    );

    pipe(
      nodeAnnotation,
      parser.run(stream.create('@isResult(true)')),
      either.map(_ => [_.data.name.name, _.data.value.type === 'Boolean' ? _.data.value.value : _]),
      _ => expect(_).toStrictEqual(either.right(['isResult', true])),
    );
  });

  test('agent-call', () => {
    pipe(
      agentCall,
      parser.run(stream.create('someAgent(hoge)')),
      either.map(_ => [
        _.data.agent.name,
        _.data.args?.type === 'Identifier' ? _.data.args.name : _,
      ]),
      _ => expect(_).toStrictEqual(either.right(['someAgent', 'hoge'])),
    );

    pipe(
      agentCall,
      parser.run(stream.create('someAgent({ inputs: {a: 1, b: 2}})')),
      either.map(_ =>
        _.data.args == null
          ? [_.data.agent.name]
          : [_.data.agent.name, toTupleFromExpr(_.data.args)],
      ),
      _ => expect(_).toStrictEqual(either.right(['someAgent', { inputs: { a: 1, b: 2 } }])),
    );
  });

  test('annotated-agent-call', () => {
    pipe(
      agentCall,
      parser.run(stream.create('@abc(123) someAgent(hoge)')),
      either.map(_ => [
        _.data.annotations.map(_ => [_.name.name, toTupleFromExpr(_.value)]),
        _.data.agent.name,
        _.data.args?.type === 'Identifier' ? _.data.args.name : _,
      ]),
      _ => expect(_).toStrictEqual(either.right([[['abc', 123]], 'someAgent', 'hoge'])),
    );

    pipe(
      agentCall,
      parser.run(
        stream.create('@abc(123) @console({after: true}) @isResult(true) someAgent(hoge)'),
      ),
      either.map(_ => [
        _.data.annotations.map(_ => [_.name.name, toTupleFromExpr(_.value)]),
        _.data.agent.name,
        _.data.args?.type === 'Identifier' ? _.data.args.name : _,
      ]),
      _ =>
        expect(_).toStrictEqual(
          either.right([
            [
              ['abc', 123],
              ['console', { after: true }],
              ['isResult', true],
            ],
            'someAgent',
            'hoge',
          ]),
        ),
    );
  });

  test('agent-def', () => {
    pipe(
      agentDef,
      parser.run(stream.create('(args) -> args.a')),
      either.map(_ => [_.data.args?.name, toTupleFromExpr(_.data.body as Expr)]),
      _ => expect(_).toStrictEqual(either.right(['args', { object: 'args', member: 'a' }])),
    );
  });

  test('power 1', () => {
    pipe(
      powerOr,
      parser.run(stream.create('2 ^ 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '^', 3])),
    );
  });

  test('mult-div-mod 1', () => {
    pipe(
      mulDivModeOr,
      parser.run(stream.create('2 * 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '*', 3])),
    );
  });

  test('mult-div-mod 2', () => {
    pipe(
      mulDivModeOr,
      parser.run(stream.create('2 / 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '/', 3])),
    );
  });

  test('mult-div-mod 3', () => {
    pipe(
      mulDivModeOr,
      parser.run(stream.create('2 % 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '%', 3])),
    );
  });

  test('mult-div-mod 4', () => {
    pipe(
      mulDivModeOr,
      parser.run(stream.create('2 * 3 / 4 % 5')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[[2, '*', 3], '/', 4], '%', 5])),
    );
  });

  test('mult-div-mod 5', () => {
    pipe(
      mulDivModeOr,
      parser.run(stream.create('1 ^ 2 * 3 ^ 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[1, '^', 2], '*', [3, '^', 4]])),
    );
  });

  test('mult-div-mod 6', () => {
    pipe(
      mulDivModeOr,
      parser.run(stream.create('1 * 2 ^ 3 / 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[1, '*', [2, '^', 3]], '/', 4])),
    );
  });

  test('plus-minus 1', () => {
    pipe(
      plusMinusOr,
      parser.run(stream.create('2 + 3 - 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[2, '+', 3], '-', 4])),
    );
  });

  test('plus-minus 2', () => {
    pipe(
      plusMinusOr,
      parser.run(stream.create('1 + 2 * 3 ^ 4 - 5 / 6')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ =>
        expect(_).toStrictEqual(either.right([[1, '+', [2, '*', [3, '^', 4]]], '-', [5, '/', 6]])),
    );
  });

  test('compare 1', () => {
    pipe(
      compareOr,
      parser.run(stream.create('2 == 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '==', 3])),
    );
  });

  test('compare 2', () => {
    pipe(
      compareOr,
      parser.run(stream.create('2 != 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '!=', 3])),
    );
  });

  test('compare 3', () => {
    pipe(
      compareOr,
      parser.run(stream.create('2 > 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '>', 3])),
    );
  });

  test('compare 4', () => {
    pipe(
      compareOr,
      parser.run(stream.create('2 >= 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '>=', 3])),
    );
  });

  test('compare 5', () => {
    pipe(
      compareOr,
      parser.run(stream.create('2 < 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '<', 3])),
    );
  });

  test('compare 6', () => {
    pipe(
      compareOr,
      parser.run(stream.create('2 <= 3')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([2, '<=', 3])),
    );
  });

  test('compare 7', () => {
    pipe(
      compareOr,
      parser.run(stream.create('1 + 2 <= 3 * 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[1, '+', 2], '<=', [3, '*', 4]])),
    );
  });

  test('logical 1', () => {
    pipe(
      logicalOr,
      parser.run(stream.create('true && false')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([true, '&&', false])),
    );
  });

  test('logical 2', () => {
    pipe(
      logicalOr,
      parser.run(stream.create('true || false')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([true, '||', false])),
    );
  });

  test('logical 3', () => {
    pipe(
      logicalOr,
      parser.run(stream.create('1 > 2 && 3 < 4')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[1, '>', 2], '&&', [3, '<', 4]])),
    );
  });

  test('if-then-else 1', () => {
    pipe(
      ifThenElse,
      parser.run(stream.create('if a then b else c')),
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
      parser.run(stream.create('if flag1 then a else if flag2 then b else c')),
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
      parser.run(stream.create('if a then println({message: 1}) else println({message: 2})')),
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
        stream.create('if a then { println({message: 1}); } else { println({message: 2}); }'),
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
      parser.run(stream.create('(1)')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([1])),
    );
  });

  test('paren 2', () => {
    pipe(
      paren,
      parser.run(stream.create('((1 + 2) * 3)')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([[[[1, '+', 2]], '*', 3]])),
    );
  });

  test('expr 1', () => {
    pipe(
      expr,
      parser.run(stream.create('a + 1 > b * 2')),
      either.map(_ => toTupleFromExpr(_.data)),
      _ => expect(_).toStrictEqual(either.right([['a', '+', 1], '>', ['b', '*', 2]])),
    );
  });

  test('expr 2', () => {
    pipe(
      expr,
      parser.run(
        stream.create('if flag then agent({inputs: {a: 1, b: 2}}) else print("flag is false")'),
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
      agentCall,
      parser.run(
        stream.create(`loop({
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
      parser.run(stream.create('static abc = 123;')),
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
        stream.create('abc = @isResult(true) @console({after: true}) agent({inputs: "hoge"});'),
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
        stream.create(`abc = @isResult(true) @console({after: true}) { 
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

  test('file 1', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
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
          either.right([
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
          ]),
        ),
    );
  });
});
