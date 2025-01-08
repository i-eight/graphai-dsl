import { GraphAI } from 'graphai';
import { agents } from '../agents';

const main = async () =>
  new GraphAI(
    {
      version: 0.6,
      nodes: {
        /* 
          def loopCallback = ({x}) => 
            if x < 10 then recur(x + 1)
            else x
  
          loop({
            init: {x: 0},
            callback: loopCallback
          })
          */
        loopCallback: {
          agent: 'defAgent',
          inputs: {
            args: ['x'],
            return: ['case', 'return'],
          },
          graph: {
            version: 0.6,
            nodes: {
              test: {
                agent: 'defAgent',
                inputs: {
                  capture: {
                    x: ':x',
                  },
                  return: ['comp'],
                },
                graph: {
                  nodes: {
                    comp: {
                      agent: 'compareAgent',
                      inputs: {
                        array: [':x', '<', 10],
                      },
                      isResult: true,
                    },
                  },
                },
              },
              increment: {
                agent: 'defAgent',
                inputs: {
                  capture: {
                    x: ':x',
                  },
                },
                graph: {
                  nodes: {
                    plus: {
                      agent: 'plusAgent',
                      inputs: {
                        left: ':x',
                        right: 1,
                      },
                    },
                    return: {
                      agent: 'recurAgent',
                      inputs: {
                        return: {
                          x: ':plus',
                        },
                      },
                      isResult: true,
                    },
                  },
                },
              },
              stop: {
                agent: 'defAgent',
                inputs: {
                  capture: {
                    x: ':x',
                  },
                },
                graph: {
                  nodes: {
                    return: {
                      agent: 'identityAgent',
                      inputs: {
                        return: ':x',
                      },
                      isResult: true,
                    },
                  },
                },
              },
              case: {
                agent: 'caseAgent',
                inputs: {
                  conditions: [{ if: ':test', then: ':increment' }, { else: ':stop' }],
                },
                isResult: true,
              },
            },
          },
        },
        loop: {
          agent: 'loopAgent',
          inputs: {
            init: { x: 0 },
            callback: ':loopCallback',
          },
          isResult: true,
          console: {
            after: true,
          },
        },
      },
    },
    agents,
  ).run();

main();
