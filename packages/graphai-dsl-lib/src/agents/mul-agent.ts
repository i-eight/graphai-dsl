import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const mulAgent: AgentFunction<
  object,
  number | string,
  Readonly<{ left: number; right: number }>
> = async ({ namedInputs: { left, right } }) => left * right;

export const mulAgentInfo: AgentFunctionInfo = {
  name: 'mulAgent',
  agent: mulAgent,
  mock: mulAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
