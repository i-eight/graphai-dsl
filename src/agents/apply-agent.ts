import { option, readonlyRecord } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const applyAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ agent: (_: unknown) => unknown | string; args: unknown }>
> = async ({ params, namedInputs: { agent, args }, forNestedGraph, filterParams, debugInfo }) =>
  typeof agent === 'function'
    ? agent({ namedInputs: args })
    : pipe(
        option.fromNullable(forNestedGraph?.agents),
        option.flatMap(readonlyRecord.lookup(agent)),
        option.match(
          () => Promise.reject(new Error(`No agents found: ${agent}`)),
          _ => _.agent({ params, namedInputs: args, forNestedGraph, filterParams, debugInfo }),
        ),
      );

export const applyAgentInfo: AgentFunctionInfo = {
  name: 'applyAgent',
  agent: applyAgent,
  mock: applyAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
