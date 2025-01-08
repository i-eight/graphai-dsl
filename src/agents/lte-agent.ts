import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const lteAgent: AgentFunction<
  object,
  boolean,
  Readonly<{ left: boolean; right: boolean }>
> = async ({ namedInputs: { left, right } }) => left <= right;

export const lteAgentInfo: AgentFunctionInfo = {
  name: 'lteAgent',
  agent: lteAgent,
  mock: lteAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
