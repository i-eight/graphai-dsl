import { GraphAI } from 'graphai/lib/graphai';
import { agents } from '../agents';

const main = async () =>
  new GraphAI(
    {
      version: 0.6,
      nodes: {
        hogeAgent: {
          agent: 'defAgent',
          inputs: {
            args: ['x', 'y'],
            return: ['plus'],
          },
          graph: {
            version: 0.6,
            nodes: {
              plus: {
                agent: 'plusAgent',
                inputs: {
                  left: ':x',
                  right: ':y',
                },
                isResult: true,
              },
            },
          },
        },
        callHoge: {
          agent: ':hogeAgent',
          inputs: {
            x: 6,
            y: 5,
          },
          console: {
            after: true,
          },
        },
        if1: {
          agent: 'defAgent',
          inputs: {
            capture: {
              callHoge: ':callHoge',
            },
            return: ['if'],
          },
          graph: {
            version: 0.6,
            nodes: {
              if: {
                agent: 'compareAgent',
                inputs: {
                  array: [':callHoge', '<', '5'],
                },
                isResult: true,
              },
            },
          },
        },
        then1: {
          agent: 'defAgent',
          inputs: {},
          graph: {
            version: 0.6,
            nodes: {
              then: {
                agent: 'copyAgent',
                inputs: {
                  message: 'callHoge < 5',
                },
                console: {
                  after: true,
                },
              },
            },
          },
        },
        if2: {
          agent: 'defAgent',
          inputs: {
            capture: {
              callHoge: ':callHoge',
            },
            return: ['if'],
          },
          graph: {
            version: 0.6,
            nodes: {
              if: {
                agent: 'compareAgent',
                inputs: {
                  array: [':callHoge', '<', '10'],
                },
                isResult: true,
              },
            },
          },
        },
        then2: {
          agent: 'defAgent',
          inputs: {},
          graph: {
            version: 0.6,
            nodes: {
              then: {
                agent: 'copyAgent',
                inputs: {
                  message: 'callHoge < 10',
                },
                console: {
                  after: true,
                },
              },
            },
          },
        },
        else: {
          agent: 'defAgent',
          inputs: {},
          graph: {
            version: 0.6,
            nodes: {
              else: {
                agent: 'copyAgent',
                inputs: {
                  message: 'callHoge >= 10',
                },
                console: {
                  after: true,
                },
              },
            },
          },
        },
        case: {
          agent: 'caseAgent',
          inputs: {
            conditions: [
              { if: ':if1', then: ':then1' },
              { if: ':if2', then: ':then2' },
              { else: ':else' },
            ],
          },
        },
      },
    },
    agents,
  ).run();

main();
