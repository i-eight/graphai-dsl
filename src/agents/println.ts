import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const println: AgentFunction<object, void, Readonly<{ message: string }>> = async context => {
  console.log(context.namedInputs.message);
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
