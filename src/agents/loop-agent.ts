import { AgentFunction, AgentFunctionContext, AgentFunctionInfo } from 'graphai';

type LoopAgentInputs = Readonly<{
  init: Readonly<Record<string, unknown>>;
  callback: (
    _: Pick<AgentFunctionContext, 'namedInputs'>,
  ) => Promise<Readonly<Record<string, unknown>>>;
}>;

const loopAgent: AgentFunction<object, unknown, LoopAgentInputs> = async ({ namedInputs }) => {
  type State = Readonly<{
    next?: boolean;
    return: Readonly<Record<string, unknown>>;
  }>;
  let state: State = {
    next: true,
    return: namedInputs.init,
  };
  while (state.next === true) {
    state = (await namedInputs.callback({ namedInputs: state.return })) as State;
  }
  return state.return;
};

export const loopAgentInfo: AgentFunctionInfo = {
  name: 'loopAgent',
  agent: loopAgent,
  mock: loopAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

const recurAgent: AgentFunction<
  object,
  Readonly<{
    next: boolean;
    return: unknown;
  }>,
  Readonly<{ return: unknown }>
> = async ({ namedInputs }) => ({
  next: true,
  return: namedInputs.return,
});

export const recurAgentInfo: AgentFunctionInfo = {
  name: 'recurAgent',
  agent: recurAgent,
  mock: recurAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
