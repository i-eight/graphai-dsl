import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const rightArrowRightArrowHyphenAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ left: unknown; right: unknown }>
> = async ({ namedInputs: _ }) => Promise.resolve(Error("Operator '>>-' is not implemented yet"));

export const rightArrowRightArrowHyphenAgentInfo: AgentFunctionInfo = {
  name: 'rightArrowRightArrowHyphenAgent',
  agent: rightArrowRightArrowHyphenAgent,
  mock: rightArrowRightArrowHyphenAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
