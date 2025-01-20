import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const rightArrowRightArrowAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ left: unknown; right: unknown }>
> = async ({ namedInputs: _ }) => Promise.resolve(Error("Operator '>>' is not implemented yet"));

export const rightArrowRightArrowAgentInfo: AgentFunctionInfo = {
  name: 'rightArrowRightArrowAgent',
  agent: rightArrowRightArrowAgent,
  mock: rightArrowRightArrowAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
