import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const println: AgentFunction<object, void, unknown> = async context => {
  console.log(context.namedInputs);
};

export const printlnInfo: AgentFunctionInfo = {
  name: 'println',
  agent: println,
  mock: println,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
