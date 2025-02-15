import { AgentFunction, AgentFunctionInfo, DefaultInputData } from 'graphai';

type LoopCallback = AgentFunction<object, unknown, unknown>;
type LoopRunCallback = AgentFunction<object, unknown, LoopCallback>;
type Loop = AgentFunction<object, LoopRunCallback, unknown>;

type Recur = Readonly<{
  type: '__recur__';
  next: boolean;
  return: DefaultInputData;
}>;

const isRecur = (result: unknown): result is Recur =>
  typeof result === 'object' && result != null && 'type' in result && result.type === '__recur__';

const loopAgent: Loop =
  async ({ namedInputs: init }) =>
  async ({ namedInputs: callback, params, filterParams, debugInfo }) => {
    type State = Readonly<{
      next?: boolean;
      return: unknown;
    }>;
    let state: State = {
      next: true,
      return: init,
    };
    while (state.next === true) {
      const r = await callback({ namedInputs: state.return, params, filterParams, debugInfo });
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
