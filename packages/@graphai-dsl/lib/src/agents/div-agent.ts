import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const divAgent: AgentFunction<
  object,
  number | string,
  Readonly<{ left: number; right: number }>
> = async ({ namedInputs: { left, right } }) => left / right;

export const divAgentInfo: AgentFunctionInfo = {
  name: 'divAgent',
  agent: divAgent,
  mock: divAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
