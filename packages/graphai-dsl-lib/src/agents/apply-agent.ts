import { option, readonlyRecord } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const isAgentFunction = (agent: unknown): agent is Pick<AgentFunctionInfo, 'name' | 'agent'> =>
  typeof agent === 'object' &&
  agent != null &&
  'name' in agent &&
  'agent' in agent &&
  typeof agent.agent === 'function';

const applyAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ agent: ((_: unknown) => unknown) | string | AgentFunctionInfo; args: unknown }>
> = async ({ params, namedInputs: { agent, args }, forNestedGraph, filterParams, debugInfo }) => {
  switch (typeof agent) {
    case 'function':
      return agent({ namedInputs: args });
    case 'string':
      return pipe(
        option.fromNullable(forNestedGraph?.agents),
        option.flatMap(readonlyRecord.lookup(agent)),
        option.match(
          () => Promise.reject(new Error(`No agents found: ${agent}`)),
          _ => _.agent({ params, namedInputs: args, forNestedGraph, filterParams, debugInfo }),
        ),
      );
    case 'object':
      if (isAgentFunction(agent)) {
        return agent.agent({ params, namedInputs: args, forNestedGraph, filterParams, debugInfo });
      } else {
        return Promise.reject(new Error(`Invalid agent: ${JSON.stringify(agent)}`));
      }
  }
};

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
