import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const colonRightArrowAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ left: unknown; right: unknown }>
> = async ({ namedInputs: _ }) => Promise.resolve(Error("Operator ':>' is not implemented yet"));

export const colonRightArrowAgentInfo: AgentFunctionInfo = {
  name: 'colonRightArrowAgent',
  agent: colonRightArrowAgent,
  mock: colonRightArrowAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
