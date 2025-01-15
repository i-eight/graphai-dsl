import { pipe } from 'fp-ts/lib/function';
import { file } from '../src/lib/dsl-parser';
import { parser } from '../src/lib/parser-combinator';
import { stream } from '../src/lib/stream';
import {
  compileGraphTest,
  parseFileTest,
  printJson,
  runGraphTest,
  toTupleFromCompileError,
} from './helpers';
import { either } from 'fp-ts';
import { compiler } from '../src/lib';
import { CompileError } from '../src/lib/compiler';
import { through } from '../src/lib/through';

describe('Compiler', () => {
  test('static-node: number', () => {
    pipe(
      file,
      parser.run(stream.create('static a = 1;')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
            },
          }),
        ),
    );
  });

  test('static-node: boolean', () => {
    pipe(
      file,
      parser.run(stream.create('static a = true;')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: true,
              },
            },
          }),
        ),
    );
  });

  test('computed-node', () => {
    pipe(
      file,
      parser.run(stream.create('a = identity({x: 1});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                agent: 'identity',
                inputs: {
                  x: 1,
                },
                isResult: true,
              },
            },
          }),
        ),
    );
  });

  test('Use an identify', () => {
    pipe(
      file,
      parser.run(stream.create('static a = 1; b = identity({x: a});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
              b: {
                agent: 'identity',
                inputs: {
                  x: ':a',
                },
                isResult: true,
              },
            },
          }),
        ),
    );
  });

  test('Use an identify before defined', () => {
    pipe(
      file,
      parser.run(stream.create('static a = 1; b = identity({x: b});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.orElse(_ => either.left([_.type, (_ as CompileError).items[0].message])),
      _ =>
        expect(_).toStrictEqual(
          either.left(['CompileError', 'Identifier can not be used before its definition: b']),
        ),
    );
  });

  test('Use an undefined identify', () => {
    pipe(
      file,
      parser.run(stream.create('static a = 1; b = identity({x: c});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.orElse(toTupleFromCompileError),
      _ => expect(_).toStrictEqual(either.left(['CompileError', 'Identifier not found: c'])),
    );
  });

  test('Anonymous node', () => {
    pipe(
      file,
      parser.run(stream.create('identity({x: 1});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon0__: {
                agent: 'identity',
                inputs: { x: 1 },
                isResult: true,
              },
            },
          }),
        ),
    );
  });

  test('Nested anonymous node', () => {
    pipe(
      file,
      parser.run(stream.create('a = agent1(agent2({x: 1}));')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon0__: {
                agent: 'agent2',
                inputs: { x: 1 },
              },
              a: {
                agent: 'agent1',
                inputs: ':__anon0__',
                isResult: true,
              },
            },
          }),
        ),
    );
  });

  test('An nonymous node in an object', () => {
    pipe(
      file,
      parser.run(stream.create('a = agent1({x: agent2({y: 1})});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon0__: {
                agent: 'agent2',
                inputs: {
                  y: 1,
                },
              },
              a: {
                agent: 'agent1',
                inputs: {
                  x: ':__anon0__',
                },
                isResult: true,
              },
            },
          }),
        ),
    );
  });

  test('Multiple nonymous nodes in an object', () => {
    pipe(
      file,
      parser.run(stream.create('a = agent1({a: agent2({y: 1}), b: agent3({x: 2})});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon0__: {
                agent: 'agent2',
                inputs: {
                  y: 1,
                },
              },
              __anon1__: {
                agent: 'agent3',
                inputs: {
                  x: 2,
                },
              },
              a: {
                agent: 'agent1',
                inputs: {
                  a: ':__anon0__',
                  b: ':__anon1__',
                },
                isResult: true,
              },
            },
          }),
        ),
    );
  });

  test('An agent with an annotation', () => {
    pipe(
      file,
      parser.run(stream.create('a = @isResult(true) agent1({x: 1});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                isResult: true,
                agent: 'agent1',
                inputs: {
                  x: 1,
                },
              },
            },
          }),
        ),
    );
  });

  test('An agent with multiple annotations', () => {
    pipe(
      file,
      parser.run(stream.create('a = @isResult(true) @console({after: true}) agent1({x: 1});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                isResult: true,
                console: {
                  after: true,
                },
                agent: 'agent1',
                inputs: {
                  x: 1,
                },
              },
            },
          }),
        ),
    );
  });

  test('An anonymous agent with multiple annotations', () => {
    pipe(
      file,
      parser.run(stream.create('@isResult(true) @console({after: true}) agent1({x: 1});')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon0__: {
                isResult: true,
                console: {
                  after: true,
                },
                agent: 'agent1',
                inputs: {
                  x: 1,
                },
              },
            },
          }),
        ),
    );
  });

  test('1 + 1', async () => {
    await pipe(
      file,
      parser.run(stream.create('@version("0.6"); 1 + 1;')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon0__: {
                agent: 'plusAgent',
                inputs: {
                  left: 1,
                  right: 1,
                },
                isResult: true,
              },
            },
          }),
        ),
      ),
      runGraphTest(either.right({ __anon0__: 2 })),
    );
  });

  test('a + b', () => {
    pipe(
      file,
      parser.run(stream.create('static a = 1; static b = 2; a + b;')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
              b: {
                value: 2,
              },
              __anon0__: {
                agent: 'plusAgent',
                inputs: {
                  left: ':a',
                  right: ':b',
                },
                isResult: true,
              },
            },
          }),
        ),
    );
  });

  test('agent1() + agent2()', () => {
    pipe(
      file,
      parser.run(stream.create('agent1() + agent2();')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon1__: {
                agent: 'agent1',
              },
              __anon2__: {
                agent: 'agent2',
              },
              __anon0__: {
                agent: 'plusAgent',
                inputs: {
                  left: ':__anon1__',
                  right: ':__anon2__',
                },
                isResult: true,
              },
            },
          }),
        ),
    );
  });

  test('A nested graph 1', () => {
    pipe(
      file,
      parser.run(stream.create('a = { static b = 1; };')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                agent: 'nestedAgent',
                inputs: {},
                graph: {
                  nodes: {
                    b: {
                      value: 1,
                    },
                  },
                },
                isResult: true,
              },
            },
          }),
        ),
    );
  });

  test('A nested graph 2', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
        foo = {
            static x = 1;
            static y = 2;
            x + y;
        };
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              foo: {
                isResult: true,
                agent: 'nestedAgent',
                inputs: {},
                graph: {
                  nodes: {
                    x: {
                      value: 1,
                    },
                    y: {
                      value: 2,
                    },
                    __anon0__: {
                      isResult: true,
                      agent: 'plusAgent',
                      inputs: {
                        left: ':x',
                        right: ':y',
                      },
                    },
                  },
                },
              },
            },
          }),
        ),
    );
  });

  test('A nested graph with a captured value in static node', () => {
    pipe(
      file,
      parser.run(stream.create('static a = 1; { static b = a; };')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
              __anon0__: {
                agent: 'nestedAgent',
                inputs: {
                  a: ':a',
                },
                isResult: true,
                graph: {
                  nodes: {
                    b: {
                      value: ':a',
                    },
                  },
                },
              },
            },
          }),
        ),
    );
  });

  test('A nested graph with a captured value', () => {
    pipe(
      file,
      parser.run(stream.create('static a = 1; { b = println({message: a}); };')),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
              __anon0__: {
                agent: 'nestedAgent',
                inputs: {
                  a: ':a',
                },
                isResult: true,
                graph: {
                  nodes: {
                    b: {
                      agent: 'println',
                      inputs: {
                        message: ':a',
                      },
                      isResult: true,
                    },
                  },
                },
              },
            },
          }),
        ),
    );
  });

  test('A deep nested graph with a captured value', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
        static a = 1; 
        { 
          b = {
            println({message: a}); 
          };
        };
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
              __anon0__: {
                agent: 'nestedAgent',
                inputs: {
                  a: ':a',
                },
                isResult: true,
                graph: {
                  nodes: {
                    b: {
                      agent: 'nestedAgent',
                      inputs: {
                        a: ':a',
                      },
                      isResult: true,
                      graph: {
                        nodes: {
                          __anon1__: {
                            agent: 'println',
                            inputs: {
                              message: ':a',
                            },
                            isResult: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        ),
    );
  });

  test('A deep nested graph with a undefined captured value', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
        a = { 
          b = {
            println({message: c}); 
          };
        };
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.orElse(toTupleFromCompileError),
      _ => expect(_).toStrictEqual(either.left(['CompileError', 'Identifier not found: c'])),
    );
  });

  test('agent-def', () => {
    pipe(
      file,
      parser.run(stream.create(`(args) -> args.a + args.b + args.c;`)),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon0__: {
                isResult: true,
                agent: 'defAgent',
                inputs: {
                  args: 'args',
                  capture: {},
                  return: ['__anon1__'],
                },
                graph: {
                  nodes: {
                    __anon2__: {
                      agent: 'getObjectMemberAgent',
                      inputs: {
                        object: ':args',
                        key: 'a',
                      },
                    },
                    __anon3__: {
                      agent: 'getObjectMemberAgent',
                      inputs: {
                        object: ':args',
                        key: 'b',
                      },
                    },
                    __anon4__: {
                      agent: 'plusAgent',
                      inputs: {
                        left: ':__anon2__',
                        right: ':__anon3__',
                      },
                    },
                    __anon5__: {
                      agent: 'getObjectMemberAgent',
                      inputs: {
                        object: ':args',
                        key: 'c',
                      },
                    },
                    __anon1__: {
                      isResult: true,
                      agent: 'plusAgent',
                      inputs: {
                        left: ':__anon4__',
                        right: ':__anon5__',
                      },
                    },
                  },
                },
              },
            },
          }),
        ),
    );
  });

  test('Captured agent-def', () => {
    pipe(
      file,
      parser.run(stream.create(`static x = 1; (args) -> args.a + args.b + args.c + x;`)),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              x: {
                value: 1,
              },
              __anon0__: {
                isResult: true,
                agent: 'defAgent',
                inputs: {
                  args: 'args',
                  capture: {
                    x: ':x',
                  },
                  return: ['__anon1__'],
                },
                graph: {
                  nodes: {
                    __anon2__: {
                      agent: 'getObjectMemberAgent',
                      inputs: {
                        object: ':args',
                        key: 'a',
                      },
                    },
                    __anon3__: {
                      agent: 'getObjectMemberAgent',
                      inputs: {
                        object: ':args',
                        key: 'b',
                      },
                    },
                    __anon4__: {
                      agent: 'plusAgent',
                      inputs: {
                        left: ':__anon2__',
                        right: ':__anon3__',
                      },
                    },
                    __anon5__: {
                      agent: 'getObjectMemberAgent',
                      inputs: {
                        object: ':args',
                        key: 'c',
                      },
                    },
                    __anon6__: {
                      agent: 'plusAgent',
                      inputs: {
                        left: ':__anon4__',
                        right: ':__anon5__',
                      },
                    },
                    __anon1__: {
                      isResult: true,
                      agent: 'plusAgent',
                      inputs: {
                        left: ':__anon6__',
                        right: ':x',
                      },
                    },
                  },
                },
              },
            },
          }),
        ),
    );
  });

  test('A basic if-then-else', () => {
    pipe(
      file,
      parser.run(
        stream.create(
          'static a = 1; if a > 1 then println({message: 1}) else println({message: 2});',
        ),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
              __anon2__: {
                agent: 'defAgent',
                inputs: {
                  args: undefined,
                  capture: {
                    a: ':a',
                  },
                  return: ['__anon1__'],
                },
                graph: {
                  nodes: {
                    __anon1__: {
                      isResult: true,
                      agent: 'gtAgent',
                      inputs: {
                        left: ':a',
                        right: 1,
                      },
                    },
                  },
                },
              },
              __anon4__: {
                agent: 'defAgent',
                inputs: {
                  args: undefined,
                  capture: {},
                  return: ['__anon3__'],
                },
                graph: {
                  nodes: {
                    __anon3__: {
                      isResult: true,
                      agent: 'println',
                      inputs: {
                        message: 1,
                      },
                    },
                  },
                },
              },
              __anon6__: {
                agent: 'defAgent',
                inputs: {
                  args: undefined,
                  capture: {},
                  return: ['__anon5__'],
                },
                graph: {
                  nodes: {
                    __anon5__: {
                      isResult: true,
                      agent: 'println',
                      inputs: {
                        message: 2,
                      },
                    },
                  },
                },
              },
              __anon0__: {
                isResult: true,
                agent: 'caseAgent',
                inputs: {
                  conditions: [
                    {
                      if: ':__anon2__',
                      then: ':__anon4__',
                    },
                    {
                      else: ':__anon6__',
                    },
                  ],
                },
              },
            },
          }),
        ),
    );
  });

  test('if-then-else with nested graphs', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
           static a = 1; 
           if a > 1 then {
             println({message: 1});
           } else {
             println({message: 2});
           };
        `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
              __anon2__: {
                agent: 'defAgent',
                inputs: {
                  args: undefined,
                  capture: {
                    a: ':a',
                  },
                  return: ['__anon1__'],
                },
                graph: {
                  nodes: {
                    __anon1__: {
                      isResult: true,
                      agent: 'gtAgent',
                      inputs: {
                        left: ':a',
                        right: 1,
                      },
                    },
                  },
                },
              },
              __anon4__: {
                agent: 'defAgent',
                inputs: {
                  args: undefined,
                  capture: {},
                  return: ['__anon3__'],
                },
                graph: {
                  nodes: {
                    __anon3__: {
                      isResult: true,
                      agent: 'println',
                      inputs: {
                        message: 1,
                      },
                    },
                  },
                },
              },
              __anon6__: {
                agent: 'defAgent',
                inputs: {
                  args: undefined,
                  capture: {},
                  return: ['__anon5__'],
                },
                graph: {
                  nodes: {
                    __anon5__: {
                      isResult: true,
                      agent: 'println',
                      inputs: {
                        message: 2,
                      },
                    },
                  },
                },
              },
              __anon0__: {
                isResult: true,
                agent: 'caseAgent',
                inputs: {
                  conditions: [
                    {
                      if: ':__anon2__',
                      then: ':__anon4__',
                    },
                    {
                      else: ':__anon6__',
                    },
                  ],
                },
              },
            },
          }),
        ),
    );
  });

  test('string 1', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
          static a = "hello";
        `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 'hello',
              },
            },
          }),
        ),
    );
  });

  test('string 2', () => {
    pipe(
      file,
      parser.run(stream.create(`static name = "Tom"; "hello, \${name}";`)),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.left({
            type: 'InvalidSyntaxError',
            message: 'String cannot be used in computed node.',
            position: {
              index: 21,
              row: 1,
              column: 22,
            },
          }),
        ),
    );
  });

  test('string 3', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
          static name = "Tom";
          println({ message: {
            text1: "hello, \${name}",
            text2: "goodbye",
          }});
        `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              name: {
                value: 'Tom',
              },
              __anon1__: {
                agent: 'concatStringAgent',
                inputs: {
                  items: ['hello, ', ':name'],
                },
              },
              __anon0__: {
                isResult: true,
                agent: 'println',
                inputs: {
                  message: {
                    text1: ':__anon1__',
                    text2: 'goodbye',
                  },
                },
              },
            },
          }),
        ),
    );
  });

  test('paren 1', () => {
    pipe(
      file,
      parser.run(stream.create(`(1 + 2);`)),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon0__: {
                isResult: true,
                agent: 'plusAgent',
                inputs: {
                  left: 1,
                  right: 2,
                },
              },
            },
          }),
        ),
    );
  });

  test('paren 2', () => {
    pipe(
      file,
      parser.run(stream.create(`(1 * (2 + 3 / (4 - 2)));`)),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon1__: {
                agent: 'minusAgent',
                inputs: {
                  left: 4,
                  right: 2,
                },
              },
              __anon2__: {
                agent: 'divAgent',
                inputs: {
                  left: 3,
                  right: ':__anon1__',
                },
              },
              __anon3__: {
                agent: 'plusAgent',
                inputs: {
                  left: 2,
                  right: ':__anon2__',
                },
              },
              __anon0__: {
                isResult: true,
                agent: 'mulAgent',
                inputs: {
                  left: 1,
                  right: ':__anon3__',
                },
              },
            },
          }),
        ),
    );
  });

  test('operator 1', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
        static a = 1;
        static b = 2;
        static c = 3;
        static d = 3;
        a + b > 10 || c * d < 10 && a + d == c;
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
              b: {
                value: 2,
              },
              c: {
                value: 3,
              },
              d: {
                value: 3,
              },
              __anon1__: {
                agent: 'plusAgent',
                inputs: {
                  left: ':a',
                  right: ':b',
                },
              },
              __anon2__: {
                agent: 'gtAgent',
                inputs: {
                  left: ':__anon1__',
                  right: 10,
                },
              },
              __anon3__: {
                agent: 'mulAgent',
                inputs: {
                  left: ':c',
                  right: ':d',
                },
              },
              __anon4__: {
                agent: 'ltAgent',
                inputs: {
                  left: ':__anon3__',
                  right: 10,
                },
              },
              __anon5__: {
                agent: 'orAgent',
                inputs: {
                  left: ':__anon2__',
                  right: ':__anon4__',
                },
              },
              __anon6__: {
                agent: 'plusAgent',
                inputs: {
                  left: ':a',
                  right: ':d',
                },
              },
              __anon7__: {
                agent: 'eqAgent',
                inputs: {
                  left: ':__anon6__',
                  right: ':c',
                },
              },
              __anon0__: {
                isResult: true,
                agent: 'andAgent',
                inputs: {
                  left: ':__anon5__',
                  right: ':__anon7__',
                },
              },
            },
          }),
        ),
    );
  });

  test('array-at 1', async () => {
    await pipe(
      parseFileTest(`
        @version("0.6");
        [1, 2, 3][0];
      `),
      compileGraphTest(
        either.right({
          version: '0.6',
          nodes: {
            __anon0__: {
              isResult: true,
              agent: 'getArrayElementAgent',
              inputs: {
                array: [1, 2, 3],
                index: 0,
              },
            },
          },
        }),
      ),
      runGraphTest(either.right({ __anon0__: 1 })),
    );
  });

  test('array-at 2', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
          static a = [2, 3, 4];
          a[0];
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: [2, 3, 4],
              },
              __anon0__: {
                isResult: true,
                agent: 'getArrayElementAgent',
                inputs: {
                  array: ':a',
                  index: 0,
                },
              },
            },
          }),
        ),
    );
  });

  test('object-member 1', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
          {a: 1, b: 2, c: 3}.a;
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon0__: {
                isResult: true,
                agent: 'getObjectMemberAgent',
                inputs: {
                  object: {
                    a: 1,
                    b: 2,
                    c: 3,
                  },
                  key: 'a',
                },
              },
            },
          }),
        ),
    );
  });

  test('object-member 2', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
          static obj = {a: 1, b: 2, c: 3};
          obj.a;
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              obj: {
                value: {
                  a: 1,
                  b: 2,
                  c: 3,
                },
              },
              __anon0__: {
                isResult: true,
                agent: 'getObjectMemberAgent',
                inputs: {
                  object: ':obj',
                  key: 'a',
                },
              },
            },
          }),
        ),
    );
  });

  test('loop', async () => {
    await pipe(
      parseFileTest(`
          @version('0.6');
          sum = loopAgent({
            init: {cnt: 0},
            callback: (args) -> 
              if args.cnt < 10 
              then recurAgent({return: {cnt: args.cnt + 1}}) 
              else identityAgent({return: args.cnt}),
          });
      `),
      compileGraphTest(
        either.right({
          version: '0.6',
          nodes: {
            __anon11__: {
              agent: 'defAgent',
              inputs: {
                args: 'args',
                capture: {},
                return: ['__anon0__'],
              },
              graph: {
                nodes: {
                  __anon3__: {
                    agent: 'defAgent',
                    inputs: {
                      args: undefined,
                      capture: {
                        args: ':args',
                      },
                      return: ['__anon1__'],
                    },
                    graph: {
                      nodes: {
                        __anon2__: {
                          agent: 'getObjectMemberAgent',
                          inputs: {
                            object: ':args',
                            key: 'cnt',
                          },
                        },
                        __anon1__: {
                          isResult: true,
                          agent: 'ltAgent',
                          inputs: {
                            left: ':__anon2__',
                            right: 10,
                          },
                        },
                      },
                    },
                  },
                  __anon7__: {
                    agent: 'defAgent',
                    inputs: {
                      args: undefined,
                      capture: {
                        args: ':args',
                      },
                      return: ['__anon4__'],
                    },
                    graph: {
                      nodes: {
                        __anon5__: {
                          agent: 'getObjectMemberAgent',
                          inputs: {
                            object: ':args',
                            key: 'cnt',
                          },
                        },
                        __anon6__: {
                          agent: 'plusAgent',
                          inputs: {
                            left: ':__anon5__',
                            right: 1,
                          },
                        },
                        __anon4__: {
                          isResult: true,
                          agent: 'recurAgent',
                          inputs: {
                            return: {
                              cnt: ':__anon6__',
                            },
                          },
                        },
                      },
                    },
                  },
                  __anon10__: {
                    agent: 'defAgent',
                    inputs: {
                      args: undefined,
                      capture: {
                        args: ':args',
                      },
                      return: ['__anon8__'],
                    },
                    graph: {
                      nodes: {
                        __anon9__: {
                          agent: 'getObjectMemberAgent',
                          inputs: {
                            object: ':args',
                            key: 'cnt',
                          },
                        },
                        __anon8__: {
                          isResult: true,
                          agent: 'identityAgent',
                          inputs: {
                            return: ':__anon9__',
                          },
                        },
                      },
                    },
                  },
                  __anon0__: {
                    isResult: true,
                    agent: 'caseAgent',
                    inputs: {
                      conditions: [
                        {
                          if: ':__anon3__',
                          then: ':__anon7__',
                        },
                        {
                          else: ':__anon10__',
                        },
                      ],
                    },
                  },
                },
              },
            },
            sum: {
              isResult: true,
              agent: 'loopAgent',
              inputs: {
                init: {
                  cnt: 0,
                },
                callback: ':__anon11__',
              },
            },
          },
        }),
      ),
      runGraphTest(either.right({ sum: 10 })),
    );
  });

  test('tutrial hello world sample', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
          // LLM
          llm = 
            @params({model: 'gpt-4o'}) 
            openAIAgent({prompt: "prompt: Explain ML's transformer in 100 words."});

          // Print the result
          println({message: llm.text});
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              llm: {
                params: {
                  model: 'gpt-4o',
                },
                agent: 'openAIAgent',
                inputs: {
                  prompt: "prompt: Explain ML's transformer in 100 words.",
                },
              },
              __anon1__: {
                agent: 'getObjectMemberAgent',
                inputs: {
                  object: ':llm',
                  key: 'text',
                },
              },
              __anon0__: {
                isResult: true,
                agent: 'println',
                inputs: {
                  message: ':__anon1__',
                },
              },
            },
          }),
        ),
    );
  });

  test('compare strings', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
          'a' == 'a';
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              __anon0__: {
                isResult: true,
                agent: 'eqAgent',
                inputs: {
                  left: 'a',
                  right: 'a',
                },
              },
            },
          }),
        ),
      ),
    );
  });

  test('nestedAgent 1', () => {
    pipe(
      file,
      parser.run(
        stream.create(`
          static a = 1;
          static b = {
            nodes: {
              n: println({message: a})
            }
          };
          c = @graph(b) nestedAgent({a: a});
      `),
      ),
      either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
      either.map(([{ json }]) => json),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              a: {
                value: 1,
              },
              __anon0__: {
                agent: 'println',
                inputs: {
                  message: ':a',
                },
              },
              b: {
                value: {
                  nodes: {
                    n: ':__anon0__',
                  },
                },
              },
              c: {
                graph: ':b',
                isResult: true,
                agent: 'nestedAgent',
                inputs: {
                  a: ':a',
                },
              },
            },
          }),
        ),
      ),
    );
  });

  test('curried function call 1', async () => {
    await pipe(
      parseFileTest(`
          @version('0.6');
          f = (a) -> (b) -> a.value + b.value;
          v = f({value: 1})({value: 2});
      `),
      compileGraphTest(),
      runGraphTest(either.right({ v: 3 })),
    );
  });
});
