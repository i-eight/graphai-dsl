import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const minusAgent: AgentFunction<
  object,
  number | string,
  Readonly<{ left: number; right: number }>
> = async ({ namedInputs: { left, right } }) => left - right;

export const minusAgentInfo: AgentFunctionInfo = {
  name: 'minusAgent',
  agent: minusAgent,
  mock: minusAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
