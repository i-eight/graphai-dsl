import OpenAI from 'openai';
import { openAIAgent } from '@graphai/agents';
import { option, task } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { Task } from 'fp-ts/lib/Task';
import { AgentFunction, AgentFunctionContext, AgentFunctionInfo } from 'graphai';

type FilterParams = AgentFunctionContext['filterParams'];
type DebugInfo = AgentFunctionContext['debugInfo'];
type OpenAIAgentReturn = OpenAI.ChatCompletion;
type OpenAIAgentParams = Readonly<{
  model?: string;
  tools?: ReadonlyArray<OpenAI.ChatCompletionTool>;
}>;
type OpenAIAgentInputs = Readonly<{
  messages?: ReadonlyArray<OpenAI.ChatCompletionMessageParam>;
  prompt: string;
}>;

const functionCalling =
  (
    from: unknown,
    agentInfo: AgentFunctionInfo,
    filterParams: FilterParams,
    debugInfo: DebugInfo,
  ): Task<OpenAIAgentReturn> =>
  () =>
    openAIAgent.agent({
      params: {
        model: 'gpt-4o',
        tools: [
          {
            type: 'function',
            function: {
              name: agentInfo.name,
              description: agentInfo.description,
              parameters: agentInfo.inputs,
            },
          },
        ],
      } satisfies OpenAIAgentParams,
      namedInputs: {
        //messages: [{ role: 'system', content: 'Hello!' }],
        prompt: String(from),
      } satisfies OpenAIAgentInputs,
      filterParams,
      debugInfo,
    });

const executeAgent = (
  agentInfo: AgentFunctionInfo,
  args: OpenAIAgentReturn,
  filterParams: FilterParams,
  debugInfo: DebugInfo,
): Task<unknown> =>
  pipe(
    option.fromNullable(args.choices[0].message?.tool_calls?.[0]),
    option.match(
      () => () =>
        Promise.reject(new Error('No tool calls of the results of the function calling found')),
      task.of,
    ),
    task.flatMap(_ =>
      pipe(
        option.fromNullable(_.function?.arguments),
        option.match(
          () => () => Promise.reject(new Error('No arguments found in the function calling')),
          _ => {
            try {
              return task.of(JSON.parse(_));
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
              return () =>
                Promise.reject(new Error('Error parsing arguments in the function calling'));
            }
          },
        ),
      ),
    ),
    task.flatMap(
      _ => () =>
        agentInfo.agent({
          params: _,
          namedInputs: _,
          filterParams,
          debugInfo,
        }),
    ),
  );

const connectAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ from: unknown; to: string }>
> = async ({ namedInputs: { from, to }, filterParams, debugInfo }) =>
  pipe(
    task.Do,
    task.bind(
      'module',
      () => () =>
        import('./index') as unknown as Promise<
          Readonly<{ agents: Record<string, AgentFunctionInfo> }>
        >,
    ),
    task.bind('agentInfo', ({ module }) =>
      to in module.agents
        ? task.of(module.agents[to])
        : () => Promise.reject(new Error(`Agent not found: ${to}`)),
    ),
    task.bind('args', ({ agentInfo }) => functionCalling(from, agentInfo, filterParams, debugInfo)),
    task.flatMap(({ agentInfo, args }) => executeAgent(agentInfo, args, filterParams, debugInfo)),
    run => run(),
  );

export const connectAgentInfo: AgentFunctionInfo = {
  name: 'connectAgent',
  agent: connectAgent,
  mock: connectAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
