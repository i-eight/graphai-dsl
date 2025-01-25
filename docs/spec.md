# DSL Specifications

## Types and Literals

| Type      | Examples                                            |
| :-------- | :-------------------------------------------------- |
| `boolean` | `true`, `false`                                     |
| `number`  | `1`, `123`, `123.456`                               |
| `string`  | `'foo'`, `'bar'`, `'Hello, ${name}'`                |
| `Array`   | `[true, 1.0, 'foo']`                                |
| `Object`  | `{ a: 1, b: 'b', c: [1, 2, 3], d: { key: value } }` |

## Operators

The operators are arranged in ascending order of precedence.

| Operator | Agent                  | Precedence |
| :------- | :--------------------- | :--------- |
| `&&`     | `andAgent`             | =          |
| `\|\|`   | `orAgent`              | ↓          |
| `==`     | `eqAgent`              | =          |
| `!=`     | `neqAgent`             | =          |
| `>`      | `gtAgent`              | =          |
| `>=`     | `gteAgent`             | =          |
| `<`      | `ltAgent`              | =          |
| `<=`     | `lteAgent`             | ↓          |
| `+`      | `plusAgent`            | =          |
| `-`      | `minusAgent`           | ↓          |
| `*`      | `mulAgent`             | =          |
| `/`      | `divAgent`             | =          |
| `%`      | `modAgent`             | ↓          |
| `^`      | `powAgent`             | ↓          |
| `[]`     | `getArrayElementAgent` | =          |
| `.`      | `getObjectMemberAgent` |            |

## Define a static node

```
static foo = 1;

--- JSON ---
foo: {
  value: 1
}
```

```
static foo = true;
--- JSON  ---
foo: {
  value: true
}
```

```
static foo = 'bar';

--- JSON ---
foo: {
  value: 'bar'
}
```

## Define a computed node

```
foo = fooAgent({ x: 1 });

--- JSON ---
foo: {
    anget: fooAgent
    inputs: {
        x: 1
    }
}
```

```
foo = @isResult(true) @console({after: true}) fooAgent({ x: 1 });

--- JSON ---
foo: {
    agent: fooAgent
    inputs: {
        x: 1
    }
    isResult: true
    console: {
        after: true
    }
}
```

```
foo =
  @isResult(true)
  @console({after: true})
  fooAgent({ x: 1 });
--- JSON ---
foo: {
    agent: fooAgent
    inputs: {
        x: 1
    }
    isResult: true
    console: {
        after: true
    }
}
```

## Anonymous node

```
static x = 1;
static y = 2;
x + y;

--- JSON ---
{
  "nodes": {
    "x": {
      "value": 1
    },
    "y": {
      "value": 2
    },
    "__anon0__": {
      "isResult": true,
      "agent": "plusAgent",
      "inputs": {
        "left": ":x",
        "right": ":y"
      }
    }
  }
}
```

```
static a = 1;
static b = 2;
println({message: a + b});

--- JSON ---
{
  "nodes": {
    "a": {
      "value": 1
    },
    "b": {
      "value": 2
    },
    "__anon1__": {
      "agent": "plusAgent",
      "inputs": {
        "left": ":a",
        "right": ":b"
      }
    },
    "__anon0__": {
      "isResult": true,
      "agent": "println",
      "inputs": {
        "message": ":__anon1__"
      }
    }
  }
}
```

## Nested graph

```
foo = {
    static x = 1;
    static y = 2;
    x + y;
}

--- JSON---
"foo": {
  "isResult": true,
  "agent": "nestedAgent",
  "inputs": {},
  "graph": {
    "nodes": {
      "x": {
        "value": 1
      },
      "y": {
        "value": 2
      },
      "__anon0__": {
        "isResult": true,
        "agent": "plusAgent",
        "inputs": {
          "left": ":x",
          "right": ":y"
        }
      }
    }
  }
}
```

```
static x = 1;
static y = 2;

graph1 = {
  graph2 = {
    graph3 = {
        println({message: x + y});
    };
  };
};

--- JSON ---
{
  "nodes": {
    "x": {
      "value": 1
    },
    "y": {
      "value": 2
    },
    "graph1": {
      "isResult": true,
      "agent": "nestedAgent",
      "inputs": {
        "x": ":x",
        "y": ":y"
      },
      "graph": {
        "nodes": {
          "graph2": {
            "isResult": true,
            "agent": "nestedAgent",
            "inputs": {
              "x": ":x",
              "y": ":y"
            },
            "graph": {
              "nodes": {
                "graph3": {
                  "isResult": true,
                  "agent": "nestedAgent",
                  "inputs": {
                    "x": ":x",
                    "y": ":y"
                  },
                  "graph": {
                    "nodes": {
                      "__anon1__": {
                        "agent": "plusAgent",
                        "inputs": {
                          "left": ":x",
                          "right": ":y"
                        }
                      },
                      "__anon0__": {
                        "isResult": true,
                        "agent": "println",
                        "inputs": {
                          "message": ":__anon1__"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Operator

```
1 + 2 * 3 < 10 || 4 / 2 ^ 3;

--- JSON ---
{
  "nodes": {
    "__anon1__": {
      "agent": "mulAgent",
      "inputs": {
        "left": 2,
        "right": 3
      }
    },
    "__anon2__": {
      "agent": "plusAgent",
      "inputs": {
        "left": 1,
        "right": ":__anon1__"
      }
    },
    "__anon3__": {
      "agent": "ltAgent",
      "inputs": {
        "left": ":__anon2__",
        "right": 10
      }
    },
    "__anon4__": {
      "agent": "powAgent",
      "inputs": {
        "base": 2,
        "exponent": 3
      }
    },
    "__anon5__": {
      "agent": "divAgent",
      "inputs": {
        "left": 4,
        "right": ":__anon4__"
      }
    },
    "__anon0__": {
      "isResult": true,
      "agent": "orAgent",
      "inputs": {
        "left": ":__anon3__",
        "right": ":__anon5__"
      }
    }
  }
}
```

## String

```
a = println({message: "Hello World"});

--- JSON ---
{
  "nodes": {
    "a": {
      "isResult": true,
      "agent": "println",
      "inputs": {
        "message": "Hello World"
      }
    }
  }
}
```

```
static name = "John";
a = println({message: "Hello World, ${name}"});

--- JSON ---
{
  "nodes": {
    "name": {
      "value": "John"
    },
    "__anon0__": {
      "agent": "concatStringAgent",
      "inputs": {
        "items": [
          "Hello World, ",
          ":name"
        ]
      }
    },
    "a": {
      "isResult": true,
      "agent": "println",
      "inputs": {
        "message": ":__anon0__"
      }
    }
  }
}
```

## Define an agent

```
hoge = (args) -> args.left + args.right;

--- JSON ---
{
  "nodes": {
    "hoge": {
      "isResult": true,
      "agent": "defAgent",
      "inputs": {
        "args": "args",
        "capture": {},
        "return": [
          "__anon0__"
        ]
      },
      "graph": {
        "nodes": {
          "__anon1__": {
            "agent": "getObjectMemberAgent",
            "inputs": {
              "object": ":args",
              "key": "left"
            }
          },
          "__anon2__": {
            "agent": "getObjectMemberAgent",
            "inputs": {
              "object": ":args",
              "key": "right"
            }
          },
          "__anon0__": {
            "isResult": true,
            "agent": "plusAgent",
            "inputs": {
              "left": ":__anon1__",
              "right": ":__anon2__"
            }
          }
        }
      }
    }
  }
}
```

## Condition

```
static a = 1;
if a < 5 then println({ message: 1}) else println({ message: 1});

--- JSON ---
{
  "nodes": {
    "a": {
      "value": 1
    },
    "__anon2__": {
      "agent": "defAgent",
      "inputs": {
        "capture": {
          "a": ":a"
        },
        "return": [
          "__anon1__"
        ]
      },
      "graph": {
        "nodes": {
          "__anon1__": {
            "isResult": true,
            "agent": "ltAgent",
            "inputs": {
              "left": ":a",
              "right": 5
            }
          }
        }
      }
    },
    "__anon4__": {
      "agent": "defAgent",
      "inputs": {
        "capture": {},
        "return": [
          "__anon3__"
        ]
      },
      "graph": {
        "nodes": {
          "__anon3__": {
            "isResult": true,
            "agent": "println",
            "inputs": {
              "message": 1
            }
          }
        }
      }
    },
    "__anon6__": {
      "agent": "defAgent",
      "inputs": {
        "capture": {},
        "return": [
          "__anon5__"
        ]
      },
      "graph": {
        "nodes": {
          "__anon5__": {
            "isResult": true,
            "agent": "println",
            "inputs": {
              "message": 1
            }
          }
        }
      }
    },
    "__anon0__": {
      "isResult": true,
      "agent": "caseAgent",
      "inputs": {
        "conditions": [
          {
            "if": ":__anon2__",
            "then": ":__anon4__"
          },
          {
            "else": ":__anon6__"
          }
        ]
      }
    }
  }
}
```

## Loop

```
@version('0.6');
sum = loop({
  init: 0,
  callback: (cnt) ->
    if cnt < 10
    then recur(cnt + 1)
    else identity(cnt),
});

--- JSON ---
{
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
}
```

## eval string

```
@version('0.6');
eval('@version("0.6"); static a = 1; static b = 1; a + b;');
```
