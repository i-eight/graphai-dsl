import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const plusAgent: AgentFunction<
  object,
  number | string,
  Readonly<{ left: number; right: number }>
> = async ({ namedInputs: { left, right } }) => left + right;

export const plusAgentInfo: AgentFunctionInfo = {
  name: 'plusAgent',
  agent: plusAgent,
  mock: plusAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
