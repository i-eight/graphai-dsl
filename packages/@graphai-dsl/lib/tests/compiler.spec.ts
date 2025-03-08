import { pipe } from 'fp-ts/lib/function';
import {
  compileFileTest,
  parseFileTest,
  parseSourceTest,
  printJson,
  runFileTest,
  runParse,
  runParser,
  toTupleFromCompileError,
  toTupleFromExpr,
} from './helpers';
import { either, readonlyRecord } from 'fp-ts';
import { through } from '../src/lib/through';
import { toReadableJson } from '../src/lib/dsl-util';
import { agentDef, computedNode } from '../src/lib/dsl-parser';

describe('Compiler', () => {
  test('static-node: number', () =>
    pipe(parseSourceTest('static a = 1;'), compileFileTest(), _ =>
      expect(_).toStrictEqual(
        either.right({
          nodes: {
            a: {
              value: 1,
            },
          },
        }),
      ),
    ));

  test('static-node: boolean', () => {
    pipe(parseSourceTest('static a = true;'), compileFileTest(), _ =>
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

  test('computed-node 1', () => {
    pipe(
      parseSourceTest('@version("0.6"); a = identity({x: 1});'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                isResult: true,
                graph: {},
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    x: 1,
                  },
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: { x: 1 } })),
    );
  });

  test('computed-node number', () => {
    pipe(
      parseSourceTest('@version("0.6"); a = 1;'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                graph: {},
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: 1,
                },
                isResult: true,
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: 1 })),
    );
  });

  test('computed-node boolean', () => {
    pipe(
      parseSourceTest('@version("0.6"); a = true;'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                graph: {},
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: true,
                },
                isResult: true,
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: true })),
    );
  });

  test('computed-node array 1', () => {
    pipe(
      parseSourceTest('@version("0.6"); a = [1, 2, 3];'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                isResult: true,
                graph: {},
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: [1, 2, 3],
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: [1, 2, 3] })),
    );
  });

  test('computed-node array 2', () => {
    pipe(
      parseSourceTest(`
        @version("0.6"); 
        a = [];
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                isResult: true,
                graph: {},
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: [],
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: [] })),
    );
  });

  test('computed-node object 1', () => {
    pipe(
      parseSourceTest('@version("0.6"); a = {a: 1, b: "b", c: [3.0], d: false};'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                isResult: true,
                graph: {},
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    a: 1,
                    b: 'b',
                    c: [3],
                    d: false,
                  },
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: { a: 1, b: 'b', c: [3.0], d: false } })),
    );
  });

  test('computed-node object 2', () => {
    pipe(
      parseSourceTest(`
        @version("0.6");
        a = {};
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                isResult: true,
                graph: {},
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {},
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: {} })),
    );
  });

  test('computed-node null', () => {
    pipe(
      parseSourceTest('@version("0.6"); a = null;'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                isResult: true,
                graph: {},
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: null,
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: null })),
    );
  });

  test('Use an identify', () =>
    pipe(
      parseSourceTest('@version("0.6"); static a = 1; b = identity({x: a});'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                value: 1,
              },
              b: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    x: ':a',
                  },
                },
                graph: {},
                isResult: true,
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ b: { x: 1 } })),
    ));

  test('Use an identify before defined', () =>
    pipe(
      parseSourceTest('static a = 1; b = identity({x: b});'),
      compileFileTest(),
      either.orElse(toTupleFromCompileError),
      _ =>
        expect(_).toStrictEqual(
          either.left(['CompileError', 'Identifier can not be used before its definition: b']),
        ),
    ));

  test('Use an undefined identify', () =>
    pipe(
      parseSourceTest('static a = 1; b = identity({x: c});'),
      compileFileTest(),
      either.orElse(toTupleFromCompileError),
      _ => expect(_).toStrictEqual(either.left(['CompileError', 'Identifier not found: c'])),
    ));

  test('Anonymous node', () =>
    pipe(
      parseSourceTest('@version("0.6"); identity({x: 1});'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon0__: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    x: 1,
                  },
                },
                isResult: true,
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: { x: 1 } })),
    ));

  test('Nested anonymous node', () =>
    pipe(
      parseSourceTest('@version("0.6"); a = identity(identity({x: 1}));'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon0__: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: { x: 1 },
                },
                graph: {},
              },
              a: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: ':__anon0__',
                },
                isResult: true,
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: { x: 1 } })),
    ));

  test('An nonymous node in an object', () =>
    pipe(
      parseSourceTest('@version("0.6"); a = identity({x: identity({y: 1})});'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon0__: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    y: 1,
                  },
                },
                graph: {},
              },
              a: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    x: ':__anon0__',
                  },
                },
                isResult: true,
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: { x: { y: 1 } } })),
    ));

  test('Multiple nonymous nodes in an object', () =>
    pipe(
      parseSourceTest('@version("0.6"); a = identity({a: identity({y: 1}), b: identity({x: 2})});'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon0__: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    y: 1,
                  },
                },
                graph: {},
              },
              __anon1__: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    x: 2,
                  },
                },
                graph: {},
              },
              a: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    a: ':__anon0__',
                    b: ':__anon1__',
                  },
                },
                isResult: true,
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: { a: { y: 1 }, b: { x: 2 } } })),
    ));

  test('An agent with an annotation', () =>
    pipe(
      parseSourceTest('@version("0.6"); a = identity@(isResult = true)({x: 1});'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                isResult: true,
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    x: 1,
                  },
                },
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: { x: 1 } })),
    ));

  test('An agent with multiple annotations', () =>
    pipe(
      parseSourceTest(
        '@version("0.6"); a = identity@(isResult = true, console = {after: true})({x: 1});',
      ),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                isResult: true,
                console: {
                  after: true,
                },
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    x: 1,
                  },
                },
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ a: { x: 1 } })),
    ));

  test('An anonymous agent with multiple annotations', () =>
    pipe(
      parseSourceTest(
        '@version("0.6"); identity@(isResult = true, console = {after: true})({x: 1});',
      ),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon0__: {
                isResult: true,
                console: {
                  after: true,
                },
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: {
                    x: 1,
                  },
                },
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: { x: 1 } })),
    ));

  test('1 + 1', async () =>
    pipe(
      parseSourceTest('@version("0.6"); 1 + 1;'),
      compileFileTest(),
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
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: 2 })),
    ));

  test('a + b', () =>
    pipe(
      parseSourceTest('@version("0.6"); static a = 1; static b = 2; a + b;'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: 3 })),
    ));

  test('agent1() + agent2()', () =>
    pipe(
      parseSourceTest('@version("0.6"); identity(1) + identity(2);'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon1__: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: 1,
                },
                graph: {},
              },
              __anon2__: {
                agent: 'apply',
                inputs: {
                  agent: 'identity',
                  args: 2,
                },
                graph: {},
              },
              __anon0__: {
                agent: 'plusAgent',
                inputs: {
                  left: ':__anon1__',
                  right: ':__anon2__',
                },
                isResult: true,
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: 3 })),
    ));

  test('A nested graph 1', () =>
    pipe(parseSourceTest('a = { static b = 1; };'), compileFileTest(), _ =>
      expect(_).toStrictEqual(
        either.right({
          nodes: {
            __anon0__: {
              agent: 'nestedAgent',
              inputs: {},
              graph: {
                nodes: {
                  b: {
                    value: 1,
                  },
                },
              },
              isResult: false,
            },
            a: {
              agent: 'getObjectMemberAgent',
              inputs: {
                key: 'b',
                object: ':__anon0__',
              },
              isResult: true,
            },
          },
        }),
      ),
    ));

  test('A nested graph 2', () =>
    pipe(
      parseSourceTest(`
        @version("0.6");
        foo = {
            static x = 1;
            static y = 2;
            x + y;
        };
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              foo: {
                isResult: true,
                agent: 'getObjectMemberAgent',
                inputs: {
                  key: '__anon0__',
                  object: ':__anon1__',
                },
              },
              __anon1__: {
                isResult: false,
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
                      graph: {},
                    },
                  },
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ foo: 3 })),
    ));

  test('A nested graph with a captured value in static node', () =>
    pipe(parseSourceTest('static a = 1; { static b = a; };'), compileFileTest(), _ =>
      expect(_).toStrictEqual(
        either.right({
          nodes: {
            a: {
              value: 1,
            },
            __anon0__: {
              agent: 'getObjectMemberAgent',
              inputs: {
                key: 'b',
                object: ':__anon1__',
              },
              isResult: true,
            },
            __anon1__: {
              agent: 'nestedAgent',
              inputs: {
                a: ':a',
              },
              isResult: false,
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
    ));

  test('A nested graph with a captured value 1', () =>
    pipe(
      parseSourceTest(`
        @version("0.6"); 
        static a = 1; 
        { b = println(a); };
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                value: 1,
              },
              __anon0__: {
                agent: 'getObjectMemberAgent',
                inputs: {
                  key: 'b',
                  object: ':__anon1__',
                },
                isResult: true,
              },
              __anon1__: {
                agent: 'nestedAgent',
                inputs: {
                  a: ':a',
                },
                isResult: false,
                graph: {
                  nodes: {
                    b: {
                      agent: 'apply',
                      inputs: {
                        agent: 'println',
                        args: ':a',
                      },
                      isResult: true,
                      graph: {},
                    },
                  },
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: null })),
    ));

  test('A deep nested graph with a captured value', () =>
    pipe(
      parseSourceTest(`
        @version("0.6");
        static a = 1; 
        { 
          b = {
            a + 2; 
          };
        };
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                value: 1,
              },
              __anon3__: {
                isResult: false,
                agent: 'nestedAgent',
                inputs: {
                  a: ':a',
                },
                graph: {
                  nodes: {
                    __anon2__: {
                      isResult: false,
                      agent: 'nestedAgent',
                      inputs: {
                        a: ':a',
                      },
                      graph: {
                        nodes: {
                          __anon1__: {
                            isResult: true,
                            graph: {},
                            agent: 'plusAgent',
                            inputs: {
                              left: ':a',
                              right: 2,
                            },
                          },
                        },
                      },
                    },
                    b: {
                      isResult: true,
                      agent: 'getObjectMemberAgent',
                      inputs: {
                        object: ':__anon2__',
                        key: '__anon1__',
                      },
                    },
                  },
                },
              },
              __anon0__: {
                isResult: true,
                agent: 'getObjectMemberAgent',
                inputs: {
                  object: ':__anon3__',
                  key: 'b',
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: 3 })),
    ));

  test('A deep nested graph with a undefined captured value', () =>
    pipe(
      parseSourceTest(`
        a = { 
          b = {
            println(c); 
          };
        };
      `),
      compileFileTest(),
      either.orElse(toTupleFromCompileError),
      _ => expect(_).toStrictEqual(either.left(['CompileError', 'Identifier not found: c'])),
    ));

  test('A deep nested graph in an array', () =>
    pipe(
      parseSourceTest(`
          @version("0.6");
          a = [
            1,
            { x = 1; y = 2; x + y; },
            2,
          ];
        `),
      compileFileTest(),
      runFileTest(either.right({ a: [1, 3, 2] })),
    ));

  test('A deep nested graph in an object', () =>
    pipe(
      parseSourceTest(`
            @version("0.6");
            {
              a: 1,
              b: { x = 1; y = 2; x + y; },
              c: 2,
            };
          `),
      compileFileTest(),
      runFileTest(either.right({ __anon0__: { a: 1, b: 3, c: 2 } })),
    ));

  test('agent-def', () =>
    pipe(
      parseSourceTest(`@version('0.6'); (args) -> args.a + args.b + args.c;`),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
                      graph: {},
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
                      graph: {},
                    },
                  },
                },
              },
            },
          }),
        ),
      ),
      runFileTest(_ => expect(either.isRight(_)).toStrictEqual(true)),
    ));

  test('Captured agent-def', () =>
    pipe(
      parseSourceTest(`@version('0.6'); static x = 1; (args) -> args.a + args.b + args.c + x;`),
      compileFileTest(),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
                      graph: {},
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
                      graph: {},
                    },
                    __anon1__: {
                      isResult: true,
                      agent: 'plusAgent',
                      inputs: {
                        left: ':__anon6__',
                        right: ':x',
                      },
                      graph: {},
                    },
                  },
                },
              },
            },
          }),
        ),
    ));

  test('Nested agent-def', () =>
    pipe(
      parseSourceTest(`
          @version('0.6'); 
          f = (a) -> {
            x = 1;
            (b) -> {
              y = 2;
              (c) -> a + b + c + x + y;
            };
          };
          f(10, 20, 30);
        `),
      compileFileTest(),
      runFileTest(either.right({ __anon6__: 63 })),
    ));

  test('A basic if-then-else', () =>
    pipe(
      parseSourceTest('@version("0.6"); static a = 1; if a > 1 then println(1) else println(2);'),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                value: 1,
              },
              __anon3__: {
                agent: 'defAgent',
                inputs: {
                  args: '__anon1__',
                  capture: {
                    a: ':a',
                  },
                  return: ['__anon2__'],
                },
                graph: {
                  nodes: {
                    __anon2__: {
                      isResult: true,
                      agent: 'gtAgent',
                      inputs: {
                        left: ':a',
                        right: 1,
                      },
                      graph: {},
                    },
                  },
                },
              },
              __anon6__: {
                agent: 'defAgent',
                inputs: {
                  args: '__anon4__',
                  capture: {},
                  return: ['__anon5__'],
                },
                graph: {
                  nodes: {
                    __anon5__: {
                      isResult: true,
                      agent: 'apply',
                      inputs: {
                        agent: 'println',
                        args: 1,
                      },
                      graph: {},
                    },
                  },
                },
              },
              __anon9__: {
                agent: 'defAgent',
                inputs: {
                  args: '__anon7__',
                  capture: {},
                  return: ['__anon8__'],
                },
                graph: {
                  nodes: {
                    __anon8__: {
                      isResult: true,
                      agent: 'apply',
                      inputs: {
                        agent: 'println',
                        args: 2,
                      },
                      graph: {},
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
                      then: ':__anon6__',
                    },
                    {
                      else: ':__anon9__',
                    },
                  ],
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({})),
    ));

  test('if-then-else with nested graphs', () =>
    pipe(
      parseSourceTest(`
           @version("0.6");
           static a = 1; 
           if a > 1 then {
             println(1);
           } else {
             println(2);
           };
        `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                value: 1,
              },
              __anon3__: {
                agent: 'defAgent',
                inputs: {
                  args: '__anon1__',
                  capture: {
                    a: ':a',
                  },
                  return: ['__anon2__'],
                },
                graph: {
                  nodes: {
                    __anon2__: {
                      isResult: true,
                      agent: 'gtAgent',
                      inputs: {
                        left: ':a',
                        right: 1,
                      },
                      graph: {},
                    },
                  },
                },
              },
              __anon6__: {
                agent: 'defAgent',
                inputs: {
                  args: '__anon4__',
                  capture: {},
                  return: ['__anon5__'],
                },
                graph: {
                  nodes: {
                    __anon5__: {
                      isResult: true,
                      agent: 'apply',
                      inputs: {
                        agent: 'println',
                        args: 1,
                      },
                      graph: {},
                    },
                  },
                },
              },
              __anon9__: {
                agent: 'defAgent',
                inputs: {
                  args: '__anon7__',
                  capture: {},
                  return: ['__anon8__'],
                },
                graph: {
                  nodes: {
                    __anon8__: {
                      isResult: true,
                      agent: 'apply',
                      inputs: {
                        agent: 'println',
                        args: 2,
                      },
                      graph: {},
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
                      then: ':__anon6__',
                    },
                    {
                      else: ':__anon9__',
                    },
                  ],
                },
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({})),
    ));

  test('string 1', () =>
    pipe(
      parseSourceTest(`
          static a = "hello";
        `),
      compileFileTest(),
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
    ));

  test('string 2', () =>
    pipe(
      parseSourceTest(`@version('0.6'); static name = "Tom"; "hello, \${name}";`),
      compileFileTest(),
      // printJson,
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              name: {
                value: 'Tom',
              },
              __anon0__: {
                graph: {},
                agent: 'concatStringAgent',
                inputs: {
                  items: ['hello, ', ':name'],
                },
                isResult: true,
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: 'hello, Tom' })),
    ));

  test('string 3', () =>
    pipe(
      parseSourceTest(`
          @version("0.6");
          static name = "Tom";
          println({
            text1: "hello, \${name}",
            text2: "goodbye",
          });
        `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              name: {
                value: 'Tom',
              },
              __anon1__: {
                agent: 'concatStringAgent',
                inputs: {
                  items: ['hello, ', ':name'],
                },
                graph: {},
              },
              __anon0__: {
                isResult: true,
                agent: 'apply',
                inputs: {
                  agent: 'println',
                  args: {
                    text1: ':__anon1__',
                    text2: 'goodbye',
                  },
                },
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({})),
    ));

  test('paren 1', () =>
    pipe(
      parseSourceTest(`@version('0.6'); (1 + 2);`),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon0__: {
                isResult: true,
                agent: 'plusAgent',
                inputs: {
                  left: 1,
                  right: 2,
                },
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: 3 })),
    ));

  test('paren 2', () =>
    pipe(
      parseSourceTest(`@version('0.6'); (1 * (2 + 3 / (4 - 2)));`),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon1__: {
                agent: 'minusAgent',
                inputs: {
                  left: 4,
                  right: 2,
                },
                graph: {},
              },
              __anon2__: {
                agent: 'divAgent',
                inputs: {
                  left: 3,
                  right: ':__anon1__',
                },
                graph: {},
              },
              __anon3__: {
                agent: 'plusAgent',
                inputs: {
                  left: 2,
                  right: ':__anon2__',
                },
                graph: {},
              },
              __anon0__: {
                isResult: true,
                agent: 'mulAgent',
                inputs: {
                  left: 1,
                  right: ':__anon3__',
                },
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: 3.5 })),
    ));

  test('operator 1', () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        static a = 1;
        static b = 2;
        static c = 3;
        static d = 3;
        a + b > 10 || c * d < 10 && a + d == c;
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
                graph: {},
              },
              __anon2__: {
                agent: 'gtAgent',
                inputs: {
                  left: ':__anon1__',
                  right: 10,
                },
                graph: {},
              },
              __anon3__: {
                agent: 'mulAgent',
                inputs: {
                  left: ':c',
                  right: ':d',
                },
                graph: {},
              },
              __anon4__: {
                agent: 'ltAgent',
                inputs: {
                  left: ':__anon3__',
                  right: 10,
                },
                graph: {},
              },
              __anon5__: {
                agent: 'orAgent',
                inputs: {
                  left: ':__anon2__',
                  right: ':__anon4__',
                },
                graph: {},
              },
              __anon6__: {
                agent: 'plusAgent',
                inputs: {
                  left: ':a',
                  right: ':d',
                },
                graph: {},
              },
              __anon7__: {
                agent: 'eqAgent',
                inputs: {
                  left: ':__anon6__',
                  right: ':c',
                },
                graph: {},
              },
              __anon0__: {
                isResult: true,
                agent: 'andAgent',
                inputs: {
                  left: ':__anon5__',
                  right: ':__anon7__',
                },
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: false })),
    ));

  test('operator 2', async () =>
    await pipe(
      parseSourceTest(`
        @version('0.6');
        static a = 1;
        f = (_) -> _ + 1;
        a |> f;
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon1__: 2 })),
    ));

  test('operator 3', async () =>
    await pipe(
      parseSourceTest(`
        @version('0.6');
        static a = 1;
        a |> ((_) -> _ + 1);
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon0__: 2 })),
    ));

  test('operator 4', async () =>
    await pipe(
      parseSourceTest(`
          @version('0.6');
          static a = 1;
          a |> (_) -> _ + 1;
        `),
      compileFileTest(),
      runFileTest(either.right({ __anon0__: 2 })),
    ));

  test('array-at 1', async () =>
    pipe(
      parseSourceTest(`
        @version("0.6");
        [1, 2, 3][0];
      `),
      compileFileTest(
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
      runFileTest(either.right({ __anon0__: 1 })),
    ));

  test('array-at 2', () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          static a = [2, 3, 4];
          a[0];
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
      ),
      runFileTest(either.right({ __anon0__: 2 })),
    ));

  test('array-at 3', () =>
    pipe(
      parseSourceTest(`
            @version('0.6');
            f = () -> [2, 3, 4];
            a = [1, f(), 5];
            a[1][2];
        `),
      compileFileTest(),
      runFileTest(either.right({ __anon3__: 4 })),
    ));

  test('object-member 1', () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          {a: 1, b: 2, c: 3}.a;
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
      ),
      runFileTest(either.right({ __anon0__: 1 })),
    ));

  test('object-member 2', () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          static obj = {a: 1, b: 2, c: 3};
          obj.a;
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
      ),
      runFileTest(either.right({ __anon0__: 1 })),
    ));

  test('object-member 3', async () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        obj = identity({
          a: 1,
          f: (_) -> _ + 1,
        });
        obj.a |> obj.f |> obj.f;
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon2__: 3 })),
    ));

  test('object-member 4', async () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        obj = identity({
          a: 1,
          f: (_) -> _.x + 1,
        });
        obj.f({x: obj.a});
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon3__: 2 })),
    ));

  test('object-member 5', async () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          o = { a: { b: 1 } };
          o.a.b;
        `),
      compileFileTest(),
      runFileTest(either.right({ __anon0__: 1 })),
    ));

  test('object-member 6', async () =>
    pipe(
      parseSourceTest(`
            @version('0.6');
            f = () -> { b: 1 };
            o = { a: f() };
            o.a.b;
          `),
      compileFileTest(),
      runFileTest(either.right({ __anon3__: 1 })),
    ));

  test('object-member 7', async () =>
    pipe(
      parseSourceTest(`
              @version('0.6');
              a = { b: 1 };
              o = { a: a };
              o.a.b;
            `),
      compileFileTest(),
      runFileTest(either.right({ __anon0__: 1 })),
    ));

  test('object-member 8', async () =>
    pipe(
      parseSourceTest(`
                @version('0.6');
                a = [{ b: { c: 2} }];
                o = { a: a[0] };
                o.a.b.c;
              `),
      compileFileTest(),
      runFileTest(either.right({ __anon1__: 2 })),
    ));

  test('object-member 9', async () =>
    pipe(
      parseSourceTest(`
                  @version('0.6');
                  s = 1;
                  o = { a: "s = \${s}" };
                  o.a;
                `),
      compileFileTest(),
      runFileTest(either.right({ __anon1__: 's = 1' })),
    ));

  test('object-member 10', async () =>
    pipe(
      parseSourceTest(`
                    @version('0.6');
                    o = {};
                    o.a;
                  `),
      compileFileTest(),
      runFileTest(either.right({ __anon0__: null })),
    ));

  test('loop', async () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          sum = loop(0, (cnt) -> 
              if cnt < 10 
              then recur(cnt + 1) 
              else cnt,
          );
      `),
      compileFileTest(),
      runFileTest(either.right({ sum: 10 })),
    ));

  test('tutrial hello world sample', () =>
    pipe(
      parseSourceTest(`
          // LLM
          llm = 
            
            openAIAgent@(params = {model: 'gpt-4o'})({prompt: "prompt: Explain ML's transformer in 100 words."});

          // Print the result
          println(llm.text);
      `),
      compileFileTest(),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            nodes: {
              llm: {
                params: {
                  model: 'gpt-4o',
                },
                agent: 'apply',
                inputs: {
                  agent: 'openAIAgent',
                  args: {
                    prompt: "prompt: Explain ML's transformer in 100 words.",
                  },
                },
                graph: {},
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
                agent: 'apply',
                inputs: {
                  agent: 'println',
                  args: ':__anon1__',
                },
                graph: {},
              },
            },
          }),
        ),
    ));

  test('compare strings', () =>
    pipe(
      parseSourceTest(`
           @version('0.6');
          'a' == 'a';
      `),
      compileFileTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              __anon0__: {
                isResult: true,
                agent: 'eqAgent',
                inputs: {
                  left: 'a',
                  right: 'a',
                },
                graph: {},
              },
            },
          }),
        ),
      ),
      runFileTest(either.right({ __anon0__: true })),
    ));

  test('nestedAgent 1', () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          static a = 1;
          static b = {
            nodes: {
              n: println(a)
            }
          };
          c =  nestedAgent@(graph = b)({a: a});
      `),
      compileFileTest(),
      _ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
            nodes: {
              a: {
                value: 1,
              },
              __anon0__: {
                agent: 'apply',
                inputs: {
                  agent: 'println',
                  args: ':a',
                },
                graph: {},
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
                agent: 'apply',
                inputs: {
                  agent: 'nestedAgent',
                  args: {
                    a: ':a',
                  },
                },
              },
            },
          }),
        ),
      //runFileTest(either.right({})),
    ));

  test('curried function call 1', async () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          f = (a) -> (b) -> a.value + b.value;
          v = f({value: 1})({value: 2});
      `),
      compileFileTest(),
      runFileTest(either.right({ v: 3 })),
    ));

  test('curried function call 2', async () =>
    pipe(
      parseSourceTest(`
            @version('0.6');
            f = (a, b) -> a + b;
            v = f(1, 2);
        `),
      compileFileTest(),
      runFileTest(either.right({ v: 3 })),
    ));

  test('curried function call 3', async () =>
    pipe(
      parseSourceTest(`
              @version('0.6');
              f = (a, b, c) -> a + b + c;
              v = 1 |> f |> (g) -> 2 |> g |> (h) -> 3 |> h;
          `),
      compileFileTest(),
      runFileTest(either.right({ v: 6 })),
    ));

  test('eval string 1', async () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          eval('@version("0.6"); static a = 1; static b = 1; a + b;');
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon0__: 2 })),
    ));

  test('import 1', async () =>
    pipe(
      parseFileTest(`${__dirname}/cases/compiler/import-1.graphai`),
      compileFileTest(),
      runFileTest(either.right({ __anon15__: { x: 18, y: 'This is import-1-package' } })),
    ));

  test('native import 1', async () =>
    pipe(
      parseFileTest(`${__dirname}/cases/compiler/native-import-1.graphai`),
      compileFileTest(),
      runFileTest(either.right({ __anon0__: 3 })),
    ));

  test('Duplicated identifier 1', async () =>
    pipe(
      parseSourceTest(`
        a = 1;
        a = 2;
      `),
      compileFileTest(),
      either.orElse(toTupleFromCompileError),
      _ =>
        expect(_).toStrictEqual(either.left(['CompileError', `Identifier 'a' is already defined`])),
    ));

  test('agent context 1', async () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        f = () -> @context.params.x;
        f@(params = {x: 1})();
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon3__: 1 })),
    ));

  test('agent context 2', async () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        f = () -> { g: () -> @context.params.x };
        f().g@(params = {x: 1})();
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon6__: 1 })),
    ));

  test('agent context 3', async () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        f = (a, b) -> {
          println(@context.params.x);
          @context.params.x + a + b;
        };
        f@(params = {x: 1})(2, 3);
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon8__: 6 })),
    ));

  test('destructuring 1', async () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        f = ([a]) -> a;
        f([1]);
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon3__: 1 })),
    ));

  test('destructuring 2', async () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          f = ([a, b]) -> a + b;
          f([1, 2]);
        `),
      compileFileTest(),
      runFileTest(either.right({ __anon3__: 3 })),
    ));

  test('destructuring 3', async () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        f = ({a}) -> a;
        f({a: 1});
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon3__: 1 })),
    ));

  test('destructuring 4', async () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        f = ({a, b}) -> a + b;
        f({a: 1, b: 2});
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon3__: 3 })),
    ));

  test('destructuring 5', async () =>
    pipe(
      parseSourceTest(`
          @version('0.6');
          f = ([a, ...xs]) -> a + xs[0] + xs[1];
          f([1, 2, 3]);
        `),
      compileFileTest(),
      runFileTest(either.right({ __anon8__: 6 })),
    ));

  test('destructuring 6', async () =>
    pipe(
      parseSourceTest(`
            @version('0.6');
            f = ({a, ...xs}) -> a + xs.b + xs.c;
            f({ a: 1, b: 2, c: 3 });
          `),
      compileFileTest(),
      runFileTest(either.right({ __anon8__: 6 })),
    ));

  test('destructuring 7', async () =>
    pipe(
      parseSourceTest(`
        @version('0.6');
        f = ([a, {b, c: d, e: [f, ...xs], ...ys}]) -> a + b + d + f + xs[0] + xs[1] + ys.g + ys.h;
        f([1, {b: 2, c: 3, e: [4, 5, 6], g: 7, h: 8}]);
      `),
      compileFileTest(),
      runFileTest(either.right({ __anon22__: 36 })),
    ));
});
