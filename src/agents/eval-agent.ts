import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';
import { compileFromString } from '../lib/compiler';
import { GraphAI, GraphData } from 'graphai';
import { pipe } from 'fp-ts/lib/function';
import { either, task } from 'fp-ts';

const evalAgent: AgentFunction<object, unknown, Readonly<{ src: string }>> = async ({
  namedInputs: { src },
}) =>
  pipe(
    compileFromString(src),
    either.match(
      e => Promise.reject(e),
      graph =>
        pipe(
          () => import('./index'),
          task.bind('result', m => () => new GraphAI(graph as GraphData, m.agents).run()),
          task.let('keys', ({ result }) => Object.keys(result)),
          task.map(({ result, keys }) => (keys.length === 1 ? result[keys[0]] : result)),
          f => f(),
        ),
    ),
  );

export const evalAgentInfo: AgentFunctionInfo = {
  name: 'evalAgent',
  agent: evalAgent,
  mock: evalAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
