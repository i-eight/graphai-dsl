import { AgentFunction, AgentFunctionContext, AgentFunctionInfo, DefaultInputData } from 'graphai';

type LoopAgentInputs = Readonly<{
  init: Readonly<Record<string, unknown>>;
  callback: (
    _: Pick<AgentFunctionContext, 'namedInputs'>,
  ) => Promise<Readonly<Record<string, unknown>>>;
}>;

type Recur = Readonly<{
  type: '__recur__';
  next: boolean;
  return: DefaultInputData;
}>;

const isRecur = (result: unknown): result is Recur =>
  typeof result === 'object' && result != null && 'type' in result && result.type === '__recur__';

const loopAgent: AgentFunction<object, unknown, LoopAgentInputs> = async ({ namedInputs }) => {
  type State = Readonly<{
    next?: boolean;
    return: DefaultInputData;
  }>;
  let state: State = {
    next: true,
    return: namedInputs.init,
  };
  while (state.next === true) {
    const r = await namedInputs.callback({ namedInputs: state.return });
    state = isRecur(r) ? r : { next: false, return: r };
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

const recurAgent: AgentFunction<object, Recur, DefaultInputData> = async ({
  namedInputs,
}): Promise<Recur> => ({
  type: '__recur__',
  next: true,
  return: namedInputs,
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
