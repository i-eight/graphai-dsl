import { option, readonlyArray, readonlyRecord, task } from 'fp-ts';
import { apply, pipe } from 'fp-ts/lib/function';
import { ReadonlyRecord } from 'fp-ts/lib/ReadonlyRecord';
import { AgentFunction, AgentFunctionContext, AgentFunctionInfo } from 'graphai';
import { unit } from '../lib';
import * as Array from './array-agent';

type AFC<Args> = AgentFunctionContext<object, Args>;
type AFR<Return> = Promise<Return>;
type Object = ReadonlyRecord<string, unknown>;

type Response = Readonly<{
  size: Size;
  keys: Keys;
  has: Has;
  get: Get;
  put: Put;
  concat: Concat;
  reduce: Reduce<unknown>;
  flatMap: FlatMap;
  map: Map;
  filter: Filter;
  find: Find;
  fromArray: FromArray;
  toArray: ToArray;
  take: Take;
}>;

//----------------------------------------------------------------------
type SizeArg = AFC<Object>;
type SizeReturn = AFR<number>;
type Size = (args: SizeArg) => SizeReturn;

const size = async ({ namedInputs: self }: SizeArg): SizeReturn => readonlyRecord.size(self);

//----------------------------------------------------------------------
type KeysArg = AFC<Object>;
type KeysReturn = AFR<ReadonlyArray<string>>;
type Keys = (args: KeysArg) => KeysReturn;

const keys = async ({ namedInputs: self }: KeysArg): KeysReturn => readonlyRecord.keys(self);

//----------------------------------------------------------------------
type HasArg1 = AFC<string>;
type HasArg2 = AFC<Object>;
type HasReturn2 = AFR<boolean>;
type HasReturn1 = AFR<(args: HasArg2) => HasReturn2>;
type Has = (key: HasArg1) => HasReturn1;

const has =
  async ({ namedInputs: key }: HasArg1): HasReturn1 =>
  async ({ namedInputs: self }: HasArg2): HasReturn2 =>
    readonlyRecord.has(key, self);

//----------------------------------------------------------------------
type GetArg1 = AFC<string>;
type GetArg2 = AFC<Object>;
type GetReturn2 = AFR<unknown>;
type GetReturn1 = AFR<(args: GetArg2) => GetReturn2>;
type Get = (key: GetArg1) => GetReturn1;

const get =
  async ({ namedInputs: key }: GetArg1): GetReturn1 =>
  async ({ namedInputs: self }: GetArg2): GetReturn2 =>
    pipe(self, readonlyRecord.lookup(key), option.toNullable);

//----------------------------------------------------------------------
type PutArg1 = AFC<string>;
type PutArg2 = AFC<unknown>;
type PutArg3 = AFC<Object>;
type PutReturn3 = AFR<Object>;
type PutReturn2 = AFR<(args: PutArg3) => PutReturn3>;
type PutReturn1 = AFR<(args: PutArg2) => PutReturn2>;
type Put = (key: PutArg1) => PutReturn1;

const put =
  async ({ namedInputs: key }: PutArg1): PutReturn1 =>
  async ({ namedInputs: value }: PutArg2): PutReturn2 =>
  async ({ namedInputs: self }: PutArg3): PutReturn3 => ({ ...self, [key]: value });

//----------------------------------------------------------------------
type ConcatArg1 = AFC<Object>;
type ConcatArg2 = AFC<Object>;
type ConcatReturn2 = AFR<Object>;
type ConcatReturn1 = AFR<(args: ConcatArg2) => ConcatReturn2>;
type Concat = (other: ConcatArg1) => ConcatReturn1;

const concat =
  async ({ namedInputs: arg1 }: ConcatArg1): ConcatReturn1 =>
  async ({ namedInputs: arg2 }: ConcatArg2): ConcatReturn2 => ({ ...arg1, ...arg2 });

//----------------------------------------------------------------------
type ReduceCallbackArg1<B> = AFC<B>;
type ReduceCallbackArg2 = AFC<Readonly<{ key: string; value: unknown }>>;
type ReduceCallbackReturn2<B> = AFR<B>;
type ReduceCallbackReturn1<B> = AFR<(args: ReduceCallbackArg2) => ReduceCallbackReturn2<B>>;
type ReduceCallback<B> = (_: ReduceCallbackArg1<B>) => ReduceCallbackReturn1<B>;
type ReduceArg1<B> = AFC<B>;
type ReduceArg2<B> = AFC<ReduceCallback<B>>;
type ReduceArg3 = AFC<Object>;
type ReduceReturn3<B> = AFR<B>;
type ReduceReturn2<B> = AFR<(args: ReduceArg3) => ReduceReturn3<B>>;
type ReduceReturn1<B> = AFR<(args: ReduceArg2<B>) => ReduceReturn2<B>>;
type Reduce<B> = (initial: ReduceArg1<B>) => ReduceReturn1<B>;

const reduce =
  async <B>({ namedInputs: initial }: ReduceArg1<B>): ReduceReturn1<B> =>
  async ({ namedInputs: callback }: ReduceArg2<B>): ReduceReturn2<B> =>
  async ({ namedInputs: self, ...arg3 }: ReduceArg3): ReduceReturn3<B> =>
    pipe(
      Object.entries(self),
      readonlyArray.reduce(task.of(initial), (fresult, [key, value]) =>
        pipe(
          task.Do,
          task.bind('result', () => fresult),
          task.flatMap(({ result }) =>
            pipe(
              () => callback({ namedInputs: result, ...arg3 }),
              task.flatMap(f => () => f({ namedInputs: { key, value }, ...arg3 })),
            ),
          ),
        ),
      ),
      apply(unit),
    );

//----------------------------------------------------------------------
type FlatMapCallbackArg = AFC<Readonly<{ key: string; value: unknown }>>;
type FlatMapCallbackReturn = AFR<Object>;
type FlatMapCallback = (_: FlatMapCallbackArg) => FlatMapCallbackReturn;
type FlatMapArg1 = AFC<FlatMapCallback>;
type FlatMapArg2 = AFC<Object>;
type FlatMapReturn2 = AFR<Object>;
type FlatMapReturn1 = AFR<(args: FlatMapArg2) => FlatMapReturn2>;
type FlatMap = (callback: FlatMapArg1) => FlatMapReturn1;

const flatMapCallback =
  (callback: FlatMapCallback): ReduceCallback<Object> =>
  async ({ namedInputs: result }: ReduceCallbackArg1<Object>): ReduceCallbackReturn1<Object> =>
  async ({
    namedInputs: { key, value },
    ...arg2
  }: ReduceCallbackArg2): ReduceCallbackReturn2<Object> =>
    pipe(
      () => callback({ namedInputs: { key, value }, ...arg2 }),
      task.map(_ => ({ ...result, ..._ })),
      apply(unit),
    );

const flatMap =
  async ({ namedInputs: callback }: FlatMapArg1): FlatMapReturn1 =>
  async ({ namedInputs: self, ...arg2 }: FlatMapArg2): FlatMapReturn2 =>
    pipe(
      () => reduce<Object>({ namedInputs: {}, ...arg2 }),
      task.flatMap(f1 => () => f1({ namedInputs: flatMapCallback(callback), ...arg2 })),
      task.flatMap(f2 => () => f2({ namedInputs: self, ...arg2 })),
      apply(unit),
    );

//----------------------------------------------------------------------
type MapCallbackArg = AFC<Readonly<{ key: string; value: unknown }>>;
type MapCallbackReturn = AFR<unknown>;
type MapCallback = (_: MapCallbackArg) => MapCallbackReturn;
type MapArg1 = AFC<MapCallback>;
type MapArg2 = AFC<Object>;
type MapReturn2 = AFR<Object>;
type MapReturn1 = AFR<(args: MapArg2) => MapReturn2>;
type Map = (callback: MapArg1) => MapReturn1;

const mapCallback =
  (callback: MapCallback): FlatMapCallback =>
  async ({ namedInputs: { key, value }, ...arg2 }: FlatMapCallbackArg): FlatMapCallbackReturn =>
    pipe(
      () => callback({ namedInputs: { key, value }, ...arg2 }),
      task.map(_ => ({ [key]: _ })),
      apply(unit),
    );

const map =
  async ({ namedInputs: callback }: MapArg1): MapReturn1 =>
  async ({ namedInputs: self, ...arg2 }: MapArg2): MapReturn2 =>
    pipe(
      () => flatMap({ namedInputs: mapCallback(callback), ...arg2 }),
      task.flatMap(f => () => f({ namedInputs: self, ...arg2 })),
      apply(unit),
    );

//----------------------------------------------------------------------
type FilterCallbackArg = AFC<Readonly<{ key: string; value: unknown }>>;
type FilterCallbackReturn = AFR<boolean>;
type FilterCallback = (_: FilterCallbackArg) => FilterCallbackReturn;
type FilterArg1 = AFC<FilterCallback>;
type FilterArg2 = AFC<Object>;
type FilterReturn2 = AFR<Object>;
type FilterReturn1 = AFR<(args: FilterArg2) => FilterReturn2>;
type Filter = (callback: FilterArg1) => FilterReturn1;

const filterCallback =
  (callback: FilterCallback): FlatMapCallback =>
  async ({ namedInputs: { key, value }, ...arg2 }: FlatMapCallbackArg): FlatMapCallbackReturn =>
    pipe(
      () => callback({ namedInputs: { key, value }, ...arg2 }),
      task.map(_ => (_ ? { [key]: value } : {})),
      apply(unit),
    );

const filter =
  async ({ namedInputs: callback }: FilterArg1): FilterReturn1 =>
  async ({ namedInputs: self, ...arg2 }: FilterArg2): FilterReturn2 =>
    pipe(
      () => flatMap({ namedInputs: filterCallback(callback), ...arg2 }),
      task.flatMap(f => () => f({ namedInputs: self, ...arg2 })),
      apply(unit),
    );

//----------------------------------------------------------------------
type FindCallbackArg = AFC<Readonly<{ key: string; value: unknown }>>;
type FindCallbackReturn = AFR<boolean>;
type FindCallback = (_: FindCallbackArg) => FindCallbackReturn;
type FindArg1 = AFC<FindCallback>;
type FindArg2 = AFC<Object>;
type FindResult = Readonly<{ key: string; value: unknown }> | null;
type FindReturn2 = AFR<FindResult>;
type FindReturn1 = AFR<(args: FindArg2) => FindReturn2>;
type Find = (callback: FindArg1) => FindReturn1;

const findCallback =
  (callback: FindCallback): ReduceCallback<FindResult> =>
  async ({
    namedInputs: result,
  }: ReduceCallbackArg1<FindResult>): ReduceCallbackReturn1<FindResult> =>
  async ({
    namedInputs: { key, value },
    ...arg2
  }: ReduceCallbackArg2): ReduceCallbackReturn2<FindResult> =>
    result == null
      ? pipe(
          () => callback({ namedInputs: { key, value }, ...arg2 }),
          task.map(_ => (_ ? { key, value } : null)),
          apply(unit),
        )
      : result;

const find =
  async ({ namedInputs: callback }: FindArg1): FindReturn1 =>
  async ({ namedInputs: self, ...arg2 }: FindArg2): FindReturn2 =>
    pipe(
      () => reduce<FindResult>({ namedInputs: null, ...arg2 }),
      task.flatMap(f1 => () => f1({ namedInputs: findCallback(callback), ...arg2 })),
      task.flatMap(f2 => () => f2({ namedInputs: self, ...arg2 })),
      apply(unit),
    );

//----------------------------------------------------------------------
type KeyValuePair = Readonly<{ key: string; value: unknown }>;
type FromArrayArg = AFC<ReadonlyArray<KeyValuePair>>;
type FromArrayReturn = AFR<Object>;
type FromArray = (args: FromArrayArg) => FromArrayReturn;

const fromArray = async ({ namedInputs: pairs, ...arg }: FromArrayArg): FromArrayReturn =>
  pipe(
    () =>
      Array.map<KeyValuePair, [string, unknown]>({
        namedInputs: async ({ namedInputs: { key, value } }) => [key, value],
        ...arg,
      }),
    task.flatMap(f => () => f({ namedInputs: pairs, ...arg })),
    task.map(Object.fromEntries),
    apply(unit),
  );

//----------------------------------------------------------------------
type ToArrayArg = AFC<Object>;
type ToArrayReturn = AFR<ReadonlyArray<KeyValuePair>>;
type ToArray = (args: ToArrayArg) => ToArrayReturn;

const toArray = async ({ namedInputs: self, ...arg }: ToArrayArg): ToArrayReturn =>
  pipe(
    () =>
      Array.map<[string, unknown], KeyValuePair>({
        namedInputs: async ({ namedInputs: [key, value] }) => ({ key, value }),
        ...arg,
      }),
    task.flatMap(f => () => f({ namedInputs: Object.entries(self), ...arg })),
    apply(unit),
  );

//----------------------------------------------------------------------
type TakeArg1 = AFC<ReadonlyArray<string>>;
type TakeArg2 = AFC<Object>;
type TakeReturn2 = AFR<[Object, Object]>;
type TakeReturn1 = AFR<(args: TakeArg2) => TakeReturn2>;
type Take = (args: TakeArg1) => TakeReturn1;

const takeCallback =
  (keys: ReadonlyArray<string>): ReduceCallback<[Object, Object]> =>
  async ({
    namedInputs: [result1, result2],
  }: ReduceCallbackArg1<[Object, Object]>): ReduceCallbackReturn1<[Object, Object]> =>
  async ({
    namedInputs: { key, value },
  }: ReduceCallbackArg2): ReduceCallbackReturn2<[Object, Object]> =>
    keys.includes(key)
      ? [{ ...result1, [key]: value }, result2]
      : [result1, { ...result2, [key]: value }];

const take =
  async ({ namedInputs: keys }: TakeArg1): TakeReturn1 =>
  async ({ namedInputs: self, ...arg2 }: TakeArg2): TakeReturn2 =>
    pipe(
      () => reduce<[Object, Object]>({ namedInputs: [{}, {}], ...arg2 }),
      task.flatMap(f1 => () => f1({ namedInputs: takeCallback(keys), ...arg2 })),
      task.flatMap(f2 => () => f2({ namedInputs: self, ...arg2 })),
      apply(unit),
    );

export const objectTakeAgentInfo: AgentFunctionInfo = {
  name: 'objectTakeAgent',
  agent: take,
  mock: take,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

//----------------------------------------------------------------------
const objectAgent: AgentFunction<object, Response> = async () => ({
  size,
  keys,
  has,
  get,
  put,
  concat,
  reduce,
  flatMap,
  map,
  filter,
  find,
  fromArray,
  toArray,
  take,
});

export const objectAgentInfo: AgentFunctionInfo = {
  name: 'objectAgent',
  agent: objectAgent,
  mock: objectAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
