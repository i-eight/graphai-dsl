import { AgentFunctionContext, AgentFunctionInfo } from 'graphai';

type Arg = AgentFunctionContext<object, unknown>;
type Return = Promise<unknown>;

const throwAgent = async ({ namedInputs: error }: Arg): Return => {
  throw error;
};

export const throwAgentInfo: AgentFunctionInfo = {
  name: 'throwAgent',
  agent: throwAgent,
  mock: throwAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
