import { AgentFunction, AgentFunctionContext, AgentFunctionInfo, GraphAI } from 'graphai';

type NestedObject = Readonly<{
  [key: string]: NestedObject;
}>;

const extractReturnValue = (result: NestedObject, returnKeys: ReadonlyArray<string>) =>
  returnKeys.reduce((r, k) => r[k], result);

const defAgent =
  async ({
    namedInputs: { args, capture, return: returnKeys },
    forNestedGraph,
  }: AgentFunctionContext<
    object,
    Readonly<{
      args?: string;
      capture?: Readonly<Record<string, unknown>>;
      return?: ReadonlyArray<string>;
    }>
  >): Promise<AgentFunction> =>
  async ({ namedInputs }) => {
    const result = (
      await new GraphAI(
        {
          version: 0.6,
          nodes: {
            exec: {
              agent: 'nestedAgent',
              inputs: args == null ? capture : { args: namedInputs, ...capture },
              //inputs: (args ?? []).reduce((r, a) => ({ ...r, [a]: namedInputs[a] }), capture ?? {}),
              graph: forNestedGraph?.graphData,
              isResult: true,
            },
          },
        },
        forNestedGraph?.agents ?? {},
      ).run()
    ).exec;
    if (typeof result === 'object' && returnKeys != null) {
      return extractReturnValue(result as NestedObject, returnKeys);
    } else {
      return result;
    }
  };

export const defAgentInfo: AgentFunctionInfo = {
  name: 'defAgent',
  agent: defAgent,
  mock: defAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
