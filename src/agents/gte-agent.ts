import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const gteAgent: AgentFunction<
  object,
  boolean,
  Readonly<{ left: boolean; right: boolean }>
> = async ({ namedInputs: { left, right } }) => left >= right;

export const gteAgentInfo: AgentFunctionInfo = {
  name: 'gteAgent',
  agent: gteAgent,
  mock: gteAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
