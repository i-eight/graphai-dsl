import { option, readonlyRecord } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { AgentFunction, AgentFunctionInfo } from 'graphai';

const getAgentInfoAgent: AgentFunction<object, AgentFunctionInfo, string> = async ({
  namedInputs: name,
  forNestedGraph,
}) =>
  pipe(
    option.fromNullable(forNestedGraph?.agents),
    option.flatMap(readonlyRecord.lookup(name)),
    option.match(
      () => Promise.reject(new Error(`No agents found: ${name}`)),
      _ => Promise.resolve(_),
    ),
  );

export const getAgentInfoAgentInfo: AgentFunctionInfo = {
  name: 'getAgentInfoAgent',
  agent: getAgentInfoAgent,
  mock: getAgentInfoAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
