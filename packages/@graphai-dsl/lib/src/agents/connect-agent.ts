import OpenAI from 'openai';
import { openAIAgent } from '@graphai/agents';
import { option, readonlyArray, task } from 'fp-ts';
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
type ToAgent = string | AgentFunctionInfo;

const functionCalling =
  (
    from: unknown,
    agentInfos: ReadonlyArray<AgentFunctionInfo>,
    filterParams: FilterParams,
    debugInfo: DebugInfo,
  ): Task<OpenAIAgentReturn> =>
  () =>
    openAIAgent.agent({
      params: {
        model: 'gpt-4o',
        tools: pipe(
          agentInfos,
          readonlyArray.map(_ => ({
            type: 'function',
            function: {
              name: _.name,
              description: _.description,
              parameters: _.inputs,
            },
          })),
        ),
      } satisfies OpenAIAgentParams,
      namedInputs: {
        messages: [{ role: 'user', content: ' Select the optimal function for the input data.' }],
        prompt: typeof from === 'string' ? from : JSON.stringify(from),
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
  Readonly<{ from: unknown; to: ToAgent | ReadonlyArray<ToAgent> }>
> = async ({ namedInputs: { from, to }, forNestedGraph, filterParams, debugInfo }) =>
  pipe(
    task.Do,
    task.bind('agents', () => task.of(forNestedGraph?.agents ?? {})),
    task.bind('toAgents', () => task.of<ReadonlyArray<ToAgent>>(Array.isArray(to) ? to : [to])),
    task.bind('agentInfos', ({ agents, toAgents }) =>
      pipe(
        toAgents,
        readonlyArray.reduce(task.of<ReadonlyArray<AgentFunctionInfo>>([]), (fres, toAgent) =>
          typeof toAgent === 'string'
            ? pipe(
                option.fromNullable(agents[toAgent]),
                option.match(
                  () => () => Promise.reject(new Error(`Agent not found: ${toAgent}`)),
                  _ =>
                    pipe(
                      fres,
                      task.map(res => [...res, _]),
                    ),
                ),
              )
            : pipe(
                fres,
                task.map(res => [...res, toAgent]),
              ),
        ),
      ),
    ),
    task.bind('args', ({ agentInfos }) =>
      functionCalling(from, agentInfos, filterParams, debugInfo),
    ),
    task.bind('agentInfo', ({ agentInfos, args }) =>
      pipe(
        option.fromNullable(args.choices[0].message?.tool_calls?.[0]?.function?.name),
        option.match(
          () => () =>
            Promise.reject(
              new Error('No function name found in the results of the function calling'),
            ),
          name =>
            pipe(
              agentInfos,
              readonlyArray.findFirst(_ => _.name === name),
              option.match(
                () => () => Promise.reject(new Error(`Agent not found: ${name}`)),
                task.of,
              ),
            ),
        ),
      ),
    ),
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
