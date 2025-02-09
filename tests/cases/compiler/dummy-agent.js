const dummyAgent = ({ namedInputs: { left, right } }) => left + right;

const dummyAgentInfo = {
  name: 'dummyAgent',
  agent: dummyAgent,
  mock: dummyAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

module.exports.dummyAgentInfo = dummyAgentInfo;
