import { pipe } from 'fp-ts/lib/function';
import {
  compileGraphTest,
  parseFileTest,
  printJson,
  runGraphTest,
  toTupleFromCompileError,
} from './helpers';
import { either } from 'fp-ts';
import { through } from '../src/lib/through';

describe('Compiler', () => {
  test('static-node: number', () =>
    pipe(parseFileTest('static a = 1;'), compileGraphTest(), _ =>
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
    pipe(parseFileTest('static a = true;'), compileGraphTest(), _ =>
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
      parseFileTest('@version("0.6"); a = identity({x: 1});'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: { x: 1 } })),
    );
  });

  test('computed-node number', () => {
    pipe(
      parseFileTest('@version("0.6"); a = 1;'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: 1 })),
    );
  });

  test('computed-node boolean', () => {
    pipe(
      parseFileTest('@version("0.6"); a = true;'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: true })),
    );
  });

  test('computed-node array', () => {
    pipe(
      parseFileTest('@version("0.6"); a = [1, 2, 3];'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: [1, 2, 3] })),
    );
  });

  test('computed-node object', () => {
    pipe(
      parseFileTest('@version("0.6"); a = {a: 1, b: "b", c: [3.0], d: false};'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: { a: 1, b: 'b', c: [3.0], d: false } })),
    );
  });

  test('computed-node null', () => {
    pipe(
      parseFileTest('@version("0.6"); a = null;'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: null })),
    );
  });

  test('Use an identify', () =>
    pipe(
      parseFileTest('@version("0.6"); static a = 1; b = identity({x: a});'),
      compileGraphTest(),
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
      runGraphTest(either.right({ b: { x: 1 } })),
    ));

  test('Use an identify before defined', () =>
    pipe(
      parseFileTest('static a = 1; b = identity({x: b});'),
      compileGraphTest(),
      either.orElse(toTupleFromCompileError),
      _ =>
        expect(_).toStrictEqual(
          either.left(['CompileError', 'Identifier can not be used before its definition: b']),
        ),
    ));

  test('Use an undefined identify', () =>
    pipe(
      parseFileTest('static a = 1; b = identity({x: c});'),
      compileGraphTest(),
      either.orElse(toTupleFromCompileError),
      _ => expect(_).toStrictEqual(either.left(['CompileError', 'Identifier not found: c'])),
    ));

  test('Anonymous node', () =>
    pipe(
      parseFileTest('@version("0.6"); identity({x: 1});'),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: { x: 1 } })),
    ));

  test('Nested anonymous node', () =>
    pipe(
      parseFileTest('@version("0.6"); a = identity(identity({x: 1}));'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: { x: 1 } })),
    ));

  test('An nonymous node in an object', () =>
    pipe(
      parseFileTest('@version("0.6"); a = identity({x: identity({y: 1})});'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: { x: { y: 1 } } })),
    ));

  test('Multiple nonymous nodes in an object', () =>
    pipe(
      parseFileTest('@version("0.6"); a = identity({a: identity({y: 1}), b: identity({x: 2})});'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: { a: { y: 1 }, b: { x: 2 } } })),
    ));

  test('An agent with an annotation', () =>
    pipe(
      parseFileTest('@version("0.6"); a = @isResult(true) identity({x: 1});'),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: { x: 1 } })),
    ));

  test('An agent with multiple annotations', () =>
    pipe(
      parseFileTest(
        '@version("0.6"); a = @isResult(true) @console({after: true}) identity({x: 1});',
      ),
      compileGraphTest(),
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
      runGraphTest(either.right({ a: { x: 1 } })),
    ));

  test('An anonymous agent with multiple annotations', () =>
    pipe(
      parseFileTest('@version("0.6"); @isResult(true) @console({after: true}) identity({x: 1});'),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: { x: 1 } })),
    ));

  test('1 + 1', async () =>
    pipe(
      parseFileTest('@version("0.6"); 1 + 1;'),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: 2 })),
    ));

  test('a + b', () =>
    pipe(
      parseFileTest('@version("0.6"); static a = 1; static b = 2; a + b;'),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: 3 })),
    ));

  test('agent1() + agent2()', () =>
    pipe(
      parseFileTest('@version("0.6"); identity(1) + identity(2);'),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: 3 })),
    ));

  test('A nested graph 1', () =>
    pipe(parseFileTest('a = { static b = 1; };'), compileGraphTest(), _ =>
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
    ));

  test('A nested graph 2', () =>
    pipe(
      parseFileTest(`
        @version("0.6");
        foo = {
            static x = 1;
            static y = 2;
            x + y;
        };
      `),
      compileGraphTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
                      graph: {},
                    },
                  },
                },
              },
            },
          }),
        ),
      ),
      runGraphTest(either.right({ foo: { __anon0__: 3 } })),
    ));

  test('A nested graph with a captured value in static node', () =>
    pipe(parseFileTest('static a = 1; { static b = a; };'), compileGraphTest(), _ =>
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
    ));

  test('A nested graph with a captured value', () =>
    pipe(
      parseFileTest('@version("0.6"); static a = 1; { b = println(a); };'),
      compileGraphTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
      runGraphTest(either.right({ __anon0__: {} })),
    ));

  test('A deep nested graph with a captured value', () =>
    pipe(
      parseFileTest(`
        @version("0.6");
        static a = 1; 
        { 
          b = {
            println(a); 
          };
        };
      `),
      compileGraphTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
                },
              },
            },
          }),
        ),
      ),
      runGraphTest(either.right({ __anon0__: { b: {} } })),
    ));

  test('A deep nested graph with a undefined captured value', () =>
    pipe(
      parseFileTest(`
        a = { 
          b = {
            println(c); 
          };
        };
      `),
      compileGraphTest(),
      either.orElse(toTupleFromCompileError),
      _ => expect(_).toStrictEqual(either.left(['CompileError', 'Identifier not found: c'])),
    ));

  test('agent-def', () =>
    pipe(
      parseFileTest(`@version('0.6'); (args) -> args.a + args.b + args.c;`),
      compileGraphTest(),
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
      runGraphTest(_ => expect(either.isRight(_)).toStrictEqual(true)),
    ));

  test('Captured agent-def', () =>
    pipe(
      parseFileTest(`@version('0.6'); static x = 1; (args) -> args.a + args.b + args.c + x;`),
      compileGraphTest(),
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

  test('A basic if-then-else', () =>
    pipe(
      parseFileTest('@version("0.6"); static a = 1; if a > 1 then println(1) else println(2);'),
      compileGraphTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
                      graph: {},
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
      ),
      runGraphTest(either.right({})),
    ));

  test('if-then-else with nested graphs', () =>
    pipe(
      parseFileTest(`
           @version("0.6");
           static a = 1; 
           if a > 1 then {
             println(1);
           } else {
             println(2);
           };
        `),
      compileGraphTest(),
      through(_ =>
        expect(_).toStrictEqual(
          either.right({
            version: '0.6',
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
                      graph: {},
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
      ),
      runGraphTest(either.right({})),
    ));

  test('string 1', () =>
    pipe(
      parseFileTest(`
          static a = "hello";
        `),
      compileGraphTest(),
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
      parseFileTest(`@version('0.6'); static name = "Tom"; "hello, \${name}";`),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: 'hello, Tom' })),
    ));

  test('string 3', () =>
    pipe(
      parseFileTest(`
          @version("0.6");
          static name = "Tom";
          println({
            text1: "hello, \${name}",
            text2: "goodbye",
          });
        `),
      compileGraphTest(),
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
      runGraphTest(either.right({})),
    ));

  test('paren 1', () =>
    pipe(
      parseFileTest(`@version('0.6'); (1 + 2);`),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: 3 })),
    ));

  test('paren 2', () =>
    pipe(
      parseFileTest(`@version('0.6'); (1 * (2 + 3 / (4 - 2)));`),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: 3.5 })),
    ));

  test('operator 1', () =>
    pipe(
      parseFileTest(`
        @version('0.6');
        static a = 1;
        static b = 2;
        static c = 3;
        static d = 3;
        a + b > 10 || c * d < 10 && a + d == c;
      `),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: false })),
    ));

  test('operator 2', async () =>
    await pipe(
      parseFileTest(`
        @version('0.6');
        static a = 1;
        f = (_) -> _ + 1;
        a |> f;
      `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon1__: 2 })),
    ));

  test('operator 3', async () =>
    await pipe(
      parseFileTest(`
        @version('0.6');
        static a = 1;
        a |> ((_) -> _ + 1);
      `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon0__: 2 })),
    ));

  test('operator 4', async () =>
    await pipe(
      parseFileTest(`
          @version('0.6');
          static a = 1;
          a |> (_) -> _ + 1;
        `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon0__: 2 })),
    ));

  test('array-at 1', async () =>
    pipe(
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
    ));

  test('array-at 2', () =>
    pipe(
      parseFileTest(`
          @version('0.6');
          static a = [2, 3, 4];
          a[0];
      `),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: 2 })),
    ));

  test('array-at 3', () =>
    pipe(
      parseFileTest(`
            @version('0.6');
            f = () -> [2, 3, 4];
            a = [1, f(), 5];
            a[1][2];
        `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon2__: 4 })),
    ));

  test('object-member 1', () =>
    pipe(
      parseFileTest(`
          @version('0.6');
          {a: 1, b: 2, c: 3}.a;
      `),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: 1 })),
    ));

  test('object-member 2', () =>
    pipe(
      parseFileTest(`
          @version('0.6');
          static obj = {a: 1, b: 2, c: 3};
          obj.a;
      `),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: 1 })),
    ));

  test('object-member 3', async () =>
    pipe(
      parseFileTest(`
        @version('0.6');
        obj = identity({
          a: 1,
          f: (_) -> _ + 1,
        });
        obj.a |> obj.f |> obj.f;
      `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon2__: 3 })),
    ));

  test('object-member 4', async () =>
    pipe(
      parseFileTest(`
        @version('0.6');
        obj = identity({
          a: 1,
          f: (_) -> _.x + 1,
        });
        obj.f({x: obj.a});
      `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon3__: 2 })),
    ));

  test('object-member 5', async () =>
    pipe(
      parseFileTest(`
          @version('0.6');
          o = { a: { b: 1 } };
          o.a.b;
        `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon0__: 1 })),
    ));

  test('object-member 6', async () =>
    pipe(
      parseFileTest(`
            @version('0.6');
            f = () -> { b: 1 };
            o = { a: f() };
            o.a.b;
          `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon2__: 1 })),
    ));

  test('object-member 7', async () =>
    pipe(
      parseFileTest(`
              @version('0.6');
              a = { b: 1 };
              o = { a: a };
              o.a.b;
            `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon0__: 1 })),
    ));

  test('object-member 8', async () =>
    pipe(
      parseFileTest(`
                @version('0.6');
                a = [{ b: { c: 2} }];
                o = { a: a[0] };
                o.a.b.c;
              `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon1__: 2 })),
    ));

  test('object-member 9', async () =>
    pipe(
      parseFileTest(`
                  @version('0.6');
                  s = 1;
                  o = { a: "s = \${s}" };
                  o.a;
                `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon1__: 's = 1' })),
    ));

  test('loop', async () =>
    pipe(
      parseFileTest(`
          @version('0.6');
          sum = loop({
            init: 0,
            callback: (cnt) -> 
              if cnt < 10 
              then recur(cnt + 1) 
              else identity(cnt),
          });
      `),
      compileGraphTest(
        either.right({
          version: '0.6',
          nodes: {
            __anon8__: {
              agent: 'defAgent',
              inputs: {
                args: 'cnt',
                capture: {},
                return: ['__anon0__'],
              },
              graph: {
                nodes: {
                  __anon2__: {
                    agent: 'defAgent',
                    inputs: {
                      args: undefined,
                      capture: {
                        cnt: ':cnt',
                      },
                      return: ['__anon1__'],
                    },
                    graph: {
                      nodes: {
                        __anon1__: {
                          isResult: true,
                          graph: {},
                          agent: 'ltAgent',
                          inputs: {
                            left: ':cnt',
                            right: 10,
                          },
                        },
                      },
                    },
                  },
                  __anon5__: {
                    agent: 'defAgent',
                    inputs: {
                      args: undefined,
                      capture: {
                        cnt: ':cnt',
                      },
                      return: ['__anon3__'],
                    },
                    graph: {
                      nodes: {
                        __anon4__: {
                          graph: {},
                          agent: 'plusAgent',
                          inputs: {
                            left: ':cnt',
                            right: 1,
                          },
                        },
                        __anon3__: {
                          isResult: true,
                          graph: {},
                          agent: 'apply',
                          inputs: {
                            agent: 'recur',
                            args: ':__anon4__',
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
                        cnt: ':cnt',
                      },
                      return: ['__anon6__'],
                    },
                    graph: {
                      nodes: {
                        __anon6__: {
                          isResult: true,
                          graph: {},
                          agent: 'apply',
                          inputs: {
                            agent: 'identity',
                            args: ':cnt',
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
                          then: ':__anon5__',
                        },
                        {
                          else: ':__anon7__',
                        },
                      ],
                    },
                  },
                },
              },
            },
            sum: {
              isResult: true,
              graph: {},
              agent: 'apply',
              inputs: {
                agent: 'loop',
                args: {
                  init: 0,
                  callback: ':__anon8__',
                },
              },
            },
          },
        }),
      ),
      runGraphTest(either.right({ sum: 10 })),
    ));

  test('tutrial hello world sample', () =>
    pipe(
      parseFileTest(`
          // LLM
          llm = 
            @params({model: 'gpt-4o'}) 
            openAIAgent({prompt: "prompt: Explain ML's transformer in 100 words."});

          // Print the result
          println(llm.text);
      `),
      compileGraphTest(),
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
      parseFileTest(`
           @version('0.6');
          'a' == 'a';
      `),
      compileGraphTest(),
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
      runGraphTest(either.right({ __anon0__: true })),
    ));

  test('nestedAgent 1', () =>
    pipe(
      parseFileTest(`
          @version('0.6');
          static a = 1;
          static b = {
            nodes: {
              n: println(a)
            }
          };
          c = @graph(b) nestedAgent({a: a});
      `),
      compileGraphTest(),
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
      //runGraphTest(either.right({})),
    ));

  test('curried function call 1', async () =>
    pipe(
      parseFileTest(`
          @version('0.6');
          f = (a) -> (b) -> a.value + b.value;
          v = f({value: 1})({value: 2});
      `),
      compileGraphTest(),
      runGraphTest(either.right({ v: 3 })),
    ));

  test('eval string 1', async () =>
    await pipe(
      parseFileTest(`
          @version('0.6');
          eval('@version("0.6"); static a = 1; static b = 1; a + b;');
      `),
      compileGraphTest(),
      runGraphTest(either.right({ __anon0__: 2 })),
    ));
});
