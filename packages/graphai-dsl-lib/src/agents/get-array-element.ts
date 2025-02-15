import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const getArrayElementAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ array: ReadonlyArray<unknown>; index: number }>
> = async ({ namedInputs: { array, index } }) => array[index];

export const getArrayElementAgentInfo: AgentFunctionInfo = {
  name: 'getArrayElementAgent',
  agent: getArrayElementAgent,
  mock: getArrayElementAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
