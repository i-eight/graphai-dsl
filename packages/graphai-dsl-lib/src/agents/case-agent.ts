import { AgentFunction, AgentFunctionContext, AgentFunctionInfo } from 'graphai';

type IfCondition = Readonly<{
  if: (_: Pick<AgentFunctionContext, 'namedInputs'>) => Promise<boolean>;
  then: (_: Pick<AgentFunctionContext, 'namedInputs'>) => Promise<unknown>;
}>;

type ElseCondition = Readonly<{
  else: (_: Pick<AgentFunctionContext, 'namedInputs'>) => Promise<unknown>;
}>;

type Condition = IfCondition | ElseCondition;

const isIf = (condition: Condition): condition is IfCondition => 'if' in condition;

const runConditions = async (conditions: ReadonlyArray<Condition>) => {
  if (conditions.length === 0) {
    return Promise.reject(new Error('Invalid conditions'));
  } else {
    const [head, ...tail] = conditions;
    if (isIf(head)) {
      const result = await head.if({ namedInputs: { args: [] } });
      if (result === true) {
        return await head.then({ namedInputs: { args: [] } });
      } else {
        return await runConditions(tail);
      }
    } else {
      return await head.else({ namedInputs: { args: [] } });
    }
  }
};

const caseAgent: AgentFunction<object, unknown> = async ({ namedInputs }) =>
  runConditions(namedInputs.conditions);

export const caseAgentInfo: AgentFunctionInfo = {
  name: 'caseAgent',
  agent: caseAgent,
  mock: caseAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
