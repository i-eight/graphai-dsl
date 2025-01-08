import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const gtAgent: AgentFunction<
  object,
  boolean,
  Readonly<{ left: boolean; right: boolean }>
> = async ({ namedInputs: { left, right } }) => left > right;

export const gtAgentInfo: AgentFunctionInfo = {
  name: 'gtAgent',
  agent: gtAgent,
  mock: gtAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
