import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const modAgent: AgentFunction<
  object,
  number | string,
  Readonly<{ left: number; right: number }>
> = async ({ namedInputs: { left, right } }) => left % right;

export const modAgentInfo: AgentFunctionInfo = {
  name: 'modAgent',
  agent: modAgent,
  mock: modAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
