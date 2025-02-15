import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const powAgent: AgentFunction<
  object,
  number | string,
  Readonly<{ left: number; right: number }>
> = async ({ namedInputs: { left, right } }) => left ** right;

export const powAgentInfo: AgentFunctionInfo = {
  name: 'powAgent',
  agent: powAgent,
  mock: powAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
