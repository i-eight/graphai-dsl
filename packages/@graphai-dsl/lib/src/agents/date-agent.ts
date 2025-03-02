import { AgentFunction, AgentFunctionInfo } from 'graphai';

type Response = Readonly<{
  now: Now;
  fromEpochTime: FromEpochTime;
  toISOString: ToISOString;
  fromISOString: FromISOString;
  toEpochTime: ToEpochTime;
}>;

type Now = AgentFunction<object, number, unknown>;

type FromEpochTime = AgentFunction<object, Date, number>;

type ToISOString = AgentFunction<object, string, Date>;

type FromISOString = AgentFunction<object, Date, string>;

type ToEpochTime = AgentFunction<object, number, Date>;

const dateAgent: AgentFunction<object, Response> = async () => ({
  now: async () => Date.now(),

  fromEpochTime: async ({ namedInputs: epochTime }) => new Date(epochTime),

  toISOString: async ({ namedInputs: date }) => date.toISOString(),

  fromISOString: async ({ namedInputs: isoString }) => new Date(isoString),

  toEpochTime: async ({ namedInputs: date }) => date.getTime(),
});

export const dateAgentInfo: AgentFunctionInfo = {
  name: 'dateAgent',
  agent: dateAgent,
  mock: dateAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
