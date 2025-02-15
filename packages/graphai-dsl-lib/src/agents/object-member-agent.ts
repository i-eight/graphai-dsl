import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const getObjectMemberAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ object: Readonly<Record<string, unknown>>; key: string }>
> = async ({ namedInputs: { object, key } }) => object[key];

export const getObjectMemberAgentInfo: AgentFunctionInfo = {
  name: 'getObjectMemberAgent',
  agent: getObjectMemberAgent,
  mock: getObjectMemberAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
