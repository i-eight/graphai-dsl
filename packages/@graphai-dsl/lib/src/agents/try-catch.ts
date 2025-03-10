import { AgentFunctionContext, AgentFunctionInfo } from 'graphai';

type AFC<Args> = AgentFunctionContext<object, Args>;
type AFR<Return> = Promise<Return>;

type TryCallbackArg = AFC<void>;
type TryCallbackReturn<A> = AFR<A>;
type TryCallback<A> = (_: TryCallbackArg) => TryCallbackReturn<A>;
type CatchCallbackArg = AFC<unknown>;
type CatchCallbackReturn<A> = AFR<A>;
type CatchCallback<A> = (_: CatchCallbackArg) => CatchCallbackReturn<A>;
type FinallyCallbackArg = AFC<void>;
type FinallyCallbackReturn = AFR<void>;
type FinallyCallback = (_: FinallyCallbackArg) => FinallyCallbackReturn;
type TryCatchArg<A> = AFC<
  Readonly<{
    try: TryCallback<A>;
    catch?: CatchCallback<A>;
    finally?: FinallyCallback;
  }>
>;
type TryCatchReturn<A> = AFR<A>;

const tryCatch = async <A>({ namedInputs: arg, ...ctx }: TryCatchArg<A>): TryCatchReturn<A> => {
  try {
    return await arg.try({ namedInputs: void 0, ...ctx });
  } catch (e) {
    return (await arg.catch?.({ namedInputs: e, ...ctx })) ?? Promise.reject(e);
  } finally {
    await arg.finally?.({ namedInputs: void 0, ...ctx });
  }
};

export const tryCatchAgentInfo: AgentFunctionInfo = {
  name: 'tryCatchAgent',
  agent: tryCatch,
  mock: tryCatch,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
