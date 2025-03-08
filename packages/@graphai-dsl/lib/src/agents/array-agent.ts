import { readonlyArray, task } from 'fp-ts';
import { apply, pipe } from 'fp-ts/lib/function';
import { AgentFunction, AgentFunctionContext, AgentFunctionInfo } from 'graphai';
import { unit } from '../lib/unit';
import { loopTask, recur } from '../lib/loop';

type Response = Readonly<{
  size: Size<unknown>;
  reduce: Reduce<unknown, unknown>;
  flatMap: FlatMap<unknown, unknown>;
  map: Map<unknown, unknown>;
  filter: Filter;
  find: Find<unknown>;
  some: Some<unknown>;
  every: Every<unknown>;
  concat: Concat<unknown>;
  splitAt: SplitAt<unknown>;
  head: Head<unknown>;
  tail: Tail<unknown>;
  sort: Sort<unknown>;
  range: Range;
  zip: Zip<unknown, unknown>;
}>;

type AFC<Args> = AgentFunctionContext<object, Args>;
type AFR<Return> = Promise<Return>;

//----------------------------------------------------------------------
type SizeArg<A> = AFC<ReadonlyArray<A>>;
type SizeReturn = AFR<number>;
type Size<A> = (_: SizeArg<A>) => SizeReturn;

const size = async <A>({ namedInputs: xs }: SizeArg<A>): SizeReturn => xs.length;

export const arraySizeAgentInfo: AgentFunctionInfo = {
  name: 'arraySizeAgent',
  agent: size,
  mock: size,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

//----------------------------------------------------------------------
type ReduceCallbackArg1<B> = AFC<B>;
type ReduceCallbackArg2<A> = AFC<A>;
type ReduceCallbackReturn2<B> = AFR<B>;
type ReduceCallbackReturn1<A, B> = AFR<(_: ReduceCallbackArg2<A>) => ReduceCallbackReturn2<B>>;
type ReduceCallback<A, B> = (_: ReduceCallbackArg1<B>) => ReduceCallbackReturn1<A, B>;
type ReduceArg1<B> = AFC<B>;
type ReduceArg2<A, B> = AFC<ReduceCallback<A, B>>;
type ReduceArg3<A> = AFC<ReadonlyArray<A>>;
type ReduceReturn3<B> = AFR<B>;
type ReduceReturn2<A, B> = AFR<(_: ReduceArg3<A>) => ReduceReturn3<B>>;
type ReduceReturn1<A, B> = AFR<(_: ReduceArg2<A, B>) => ReduceReturn2<A, B>>;
type Reduce<A, B> = (_: ReduceArg1<B>) => ReduceReturn1<A, B>;

const reduce =
  async <A, B>({ namedInputs: initial }: ReduceArg1<B>): ReduceReturn1<A, B> =>
  async ({ namedInputs: callback }: ReduceArg2<A, B>): ReduceReturn2<A, B> =>
  ({ namedInputs: self, ...args }: ReduceArg3<A>): ReduceReturn3<B> =>
    pipe(
      self,
      readonlyArray.reduce(task.of<B>(initial), (fresult, value) =>
        pipe(
          fresult,
          task.flatMap(result =>
            pipe(
              () => callback({ namedInputs: result, ...args }),
              task.flatMap(f => () => f({ namedInputs: value, ...args })),
            ),
          ),
        ),
      ),
      apply(unit),
    );

//----------------------------------------------------------------------
type FlatMapCallback<A, B> = (_: AFC<A>) => AFR<ReadonlyArray<B>>;
type FlatMapArg1<A, B> = AFC<FlatMapCallback<A, B>>;
type FlatMapArg2<A> = AFC<ReadonlyArray<A>>;
type FlatMapReturn2<B> = AFR<ReadonlyArray<B>>;
type FlatMapReturn1<A, B> = AFR<(_: FlatMapArg2<A>) => FlatMapReturn2<B>>;
type FlatMap<A, B> = (arg1: FlatMapArg1<A, B>) => FlatMapReturn1<A, B>;

const flatMapCallback =
  <A, B>(callback: FlatMapCallback<A, B>): ReduceCallback<A, ReadonlyArray<B>> =>
  async ({
    namedInputs: result,
  }: ReduceCallbackArg1<ReadonlyArray<B>>): ReduceCallbackReturn1<A, ReadonlyArray<B>> =>
  async ({
    namedInputs: value,
    ...arg2
  }: ReduceCallbackArg2<A>): ReduceCallbackReturn2<ReadonlyArray<B>> =>
    pipe(
      () => callback({ namedInputs: value, ...arg2 }),
      task.map(xs => [...result, ...xs]),
      apply(unit),
    );

const flatMap =
  async <A, B>({ namedInputs: callback }: FlatMapArg1<A, B>): FlatMapReturn1<A, B> =>
  ({ namedInputs: self, ...arg2 }: FlatMapArg2<A>): FlatMapReturn2<B> =>
    pipe(
      () => reduce<A, ReadonlyArray<B>>({ namedInputs: [], ...arg2 }),
      task.flatMap(f1 => () => f1({ namedInputs: flatMapCallback(callback), ...arg2 })),
      task.flatMap(f2 => () => f2({ namedInputs: self, ...arg2 })),
      apply(unit),
    );

//----------------------------------------------------------------------
type MapCallback<A, B> = (_: AFC<A>) => AFR<B>;
type MapArg1<A, B> = AFC<MapCallback<A, B>>;
type MapArg2<A> = AFC<ReadonlyArray<A>>;
type MapReturn2<B> = AFR<ReadonlyArray<B>>;
type MapReturn1<A, B> = AFR<(_: MapArg2<A>) => MapReturn2<B>>;
type Map<A, B> = (arg1: MapArg1<A, B>) => MapReturn1<A, B>;

export const map =
  async <A, B>({ namedInputs: callback }: MapArg1<A, B>): MapReturn1<A, B> =>
  ({ namedInputs: self, ...arg2 }: MapArg2<A>): MapReturn2<B> =>
    pipe(
      () =>
        flatMap<A, B>({
          namedInputs: ({ namedInputs: value, ...arg3 }) =>
            pipe(
              () => callback({ namedInputs: value, ...arg3 }),
              task.map(x => [x]),
              apply(unit),
            ),
          ...arg2,
        }),
      task.flatMap(f => () => f({ namedInputs: self, ...arg2 })),
      apply(unit),
    );

//----------------------------------------------------------------------
type FilterCallback<A> = (_: AFC<A>) => AFR<boolean>;
type FilterArg1<A> = AFC<FilterCallback<A>>;
type FilterArg2<A> = AFC<ReadonlyArray<A>>;
type FilterReturn2<A> = AFR<ReadonlyArray<A>>;
type FilterReturn1<A> = AFR<(_: FilterArg2<A>) => FilterReturn2<A>>;
type Filter = <A>(arg1: FilterArg1<A>) => FilterReturn1<A>;

const filter =
  async <A>({ namedInputs: callback }: FilterArg1<A>): FilterReturn1<A> =>
  ({ namedInputs: self, ...arg2 }: FilterArg2<A>): FilterReturn2<A> =>
    pipe(
      () =>
        flatMap<A, A>({
          namedInputs: ({ namedInputs: value, ...arg3 }) =>
            pipe(
              () => callback({ namedInputs: value, ...arg3 }),
              task.map(flag => (flag ? [value] : [])),
              apply(unit),
            ),
          ...arg2,
        }),
      task.flatMap(f => () => f({ namedInputs: self, ...arg2 })),
      apply(unit),
    );

//----------------------------------------------------------------------
type FindCallback<A> = (_: AFC<A>) => AFR<boolean>;
type FindArg1<A> = AFC<FindCallback<A>>;
type FindArg2<A> = AFC<ReadonlyArray<A>>;
type FindReturn2<A> = AFR<A | null>;
type FindReturn1<A> = AFR<(_: FindArg2<A>) => FindReturn2<A>>;
type Find<A> = (arg1: FindArg1<A>) => FindReturn1<A>;

const find =
  async <A>({ namedInputs: callback }: FindArg1<A>): FindReturn1<A> =>
  ({ namedInputs: self, ...arg2 }: FindArg2<A>): FindReturn2<A> =>
    pipe(
      loopTask<[A | null, number]>([null, 0], ([a, i]) =>
        a != null || i >= self.length
          ? task.of([a, i])
          : pipe(
              () => callback({ namedInputs: self[i], ...arg2 }),
              task.map(flag => (flag === true ? [self[i], i + 1] : recur([null, i + 1]))),
            ),
      ),
      task.map(([a, _]) => a),
      apply(unit),
    );

//----------------------------------------------------------------------
type SomeCallback<A> = (_: AFC<A>) => AFR<boolean>;
type SomeArg1<A> = AFC<SomeCallback<A>>;
type SomeArg2<A> = AFC<ReadonlyArray<A>>;
type SomeReturn2 = AFR<boolean>;
type SomeReturn1<A> = AFR<(_: SomeArg2<A>) => SomeReturn2>;
type Some<A> = (arg1: SomeArg1<A>) => SomeReturn1<A>;

const some =
  async <A>({ namedInputs: callback }: SomeArg1<A>): SomeReturn1<A> =>
  ({ namedInputs: self, ...arg2 }: SomeArg2<A>): SomeReturn2 =>
    pipe(
      () =>
        find<A>({
          namedInputs: ({ namedInputs: values, ...arg3 }) =>
            pipe(() => callback({ namedInputs: values, ...arg3 }), apply(unit)),
          ...arg2,
        }),
      task.flatMap(f => () => f({ namedInputs: self, ...arg2 })),
      task.map(a => a !== null),
      apply(unit),
    );

//----------------------------------------------------------------------
type EveryCallback<A> = (_: AFC<A>) => AFR<boolean>;
type EveryArg1<A> = AFC<EveryCallback<A>>;
type EveryArg2<A> = AFC<ReadonlyArray<A>>;
type EveryReturn2 = AFR<boolean>;
type EveryReturn1<A> = AFR<(_: EveryArg2<A>) => EveryReturn2>;
type Every<A> = (arg1: EveryArg1<A>) => EveryReturn1<A>;

const everyCallback =
  <A>(callback: EveryCallback<A>): ReduceCallback<A, boolean> =>
  async ({ namedInputs: result }: ReduceCallbackArg1<boolean>): ReduceCallbackReturn1<A, boolean> =>
  async ({ namedInputs: value, ...arg2 }: ReduceCallbackArg2<A>): ReduceCallbackReturn2<boolean> =>
    pipe(
      () => callback({ namedInputs: value, ...arg2 }),
      task.map(flag => result && flag),
      apply(unit),
    );

const every =
  async <A>({ namedInputs: callback }: EveryArg1<A>): EveryReturn1<A> =>
  ({ namedInputs: self, ...arg2 }: EveryArg2<A>): EveryReturn2 =>
    pipe(
      () => reduce<A, boolean>({ namedInputs: true, ...arg2 }),
      task.flatMap(f1 => () => f1({ namedInputs: everyCallback(callback), ...arg2 })),
      task.flatMap(f2 => () => f2({ namedInputs: self, ...arg2 })),
      apply(unit),
    );

//----------------------------------------------------------------------
type SplitAtArg1 = AFC<number>;
type SplitAtArg2<A> = AFC<ReadonlyArray<A>>;
type SplitAtReturn2<A> = AFR<readonly [ReadonlyArray<A>, ReadonlyArray<A>]>;
type SplitAtReturn1<A> = AFR<(_: SplitAtArg2<A>) => SplitAtReturn2<A>>;
type SplitAt<A> = (arg1: SplitAtArg1) => SplitAtReturn1<A>;

const splitAt =
  async <A>({ namedInputs: index }: SplitAtArg1): SplitAtReturn1<A> =>
  async ({ namedInputs: self }: SplitAtArg2<A>): SplitAtReturn2<A> =>
    pipe(self, readonlyArray.splitAt(index));

export const arraySplitAtAgentInfo: AgentFunctionInfo = {
  name: 'arraySplitAtAgent',
  agent: splitAt,
  mock: splitAt,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

//----------------------------------------------------------------------
type HeadArg<A> = AFC<ReadonlyArray<A>>;
type HeadReturn<A> = AFR<A | null>;
type Head<A> = (_: HeadArg<A>) => HeadReturn<A>;

const head = async <A>({ namedInputs: self }: HeadArg<A>): HeadReturn<A> =>
  self.length > 0 ? self[0] : null;

//----------------------------------------------------------------------
type TailArg<A> = AFC<ReadonlyArray<A>>;
type TailReturn<A> = AFR<ReadonlyArray<A>>;
type Tail<A> = (_: TailArg<A>) => TailReturn<A>;

const tail = async <A>({ namedInputs: self }: TailArg<A>): TailReturn<A> => self.slice(1);

//----------------------------------------------------------------------
type SortCallbackArg1<A> = AFC<A>;
type SortCallbackArg2<A> = AFC<A>;
type SortCallbackReturn2 = AFR<-1 | 0 | 1>;
type SortCallbackReturn1<A> = AFR<(_: SortCallbackArg2<A>) => SortCallbackReturn2>;
type SortCallback<A> = (arg1: SortCallbackArg1<A>) => SortCallbackReturn1<A>;
type SortArg1<A> = AFC<SortCallback<A>>;
type SortArg2<A> = AFC<ReadonlyArray<A>>;
type SortReturn2<A> = AFR<ReadonlyArray<A>>;
type SortReturn1<A> = AFR<(_: SortArg2<A>) => SortReturn2<A>>;
type Sort<A> = (arg1: SortArg1<A>) => SortReturn1<A>;

const sortArray = async <A>(
  inputArray: ReadonlyArray<A>,
  compareFn: (a: A, b: A) => Promise<number>,
): Promise<ReadonlyArray<A>> => {
  const arr = inputArray.slice();

  for (let i = 0; i < arr.length - 1; i++) {
    let selectedIndex = i;
    for (let j = i + 1; j < arr.length; j++) {
      if (typeof compareFn === 'function') {
        if ((await compareFn(arr[j], arr[selectedIndex])) < 0) {
          selectedIndex = j;
        }
      } else {
        if (arr[j] < arr[selectedIndex]) {
          selectedIndex = j;
        }
      }
    }

    if (selectedIndex !== i) {
      const temp = arr[i];
      arr[i] = arr[selectedIndex];
      arr[selectedIndex] = temp;
    }
  }

  return arr;
};

const sort =
  async <A>({ namedInputs: callback }: SortArg1<A>): SortReturn1<A> =>
  async ({ namedInputs: self, ...arg2 }: SortArg2<A>): SortReturn2<A> =>
    sortArray(self, async (a, b) =>
      pipe(
        () => callback({ namedInputs: a, ...arg2 }),
        task.flatMap(f => () => f({ namedInputs: b, ...arg2 })),
        apply(unit),
      ),
    );

//----------------------------------------------------------------------
type ConcatArg1<A> = AFC<ReadonlyArray<A>>;
type ConcatArg2<A> = AFC<ReadonlyArray<A>>;
type ConcatReturn2<A> = AFR<ReadonlyArray<A>>;
type ConcatReturn1<A> = AFR<(_: ConcatArg2<A>) => ConcatReturn2<A>>;
type Concat<A> = (arg1: ConcatArg1<A>) => ConcatReturn1<A>;

const concat =
  async <A>({ namedInputs: arg1 }: ConcatArg1<A>): ConcatReturn1<A> =>
  async ({ namedInputs: arg2 }: ConcatArg2<A>): ConcatReturn2<A> => [...arg1, ...arg2];

//----------------------------------------------------------------------
type RangeArg1 = AFC<number>;
type RangeArg2 = AFC<number>;
type RangeReturn2 = AFR<ReadonlyArray<number>>;
type RangeReturn1 = AFR<(_: RangeArg2) => RangeReturn2>;
type Range = (arg1: RangeArg1) => RangeReturn1;

const range =
  async ({ namedInputs: arg1 }: RangeArg1): RangeReturn1 =>
  async ({ namedInputs: arg2 }: RangeArg2): RangeReturn2 =>
    arg2 > arg1
      ? Array.from({ length: arg2 - arg1 }, (_, i) => i + arg1)
      : Array.from({ length: arg1 - arg2 }, (_, i) => arg1 - i);

//----------------------------------------------------------------------
type ZipArg1<A> = AFC<ReadonlyArray<A>>;
type ZipArg2<B> = AFC<ReadonlyArray<B>>;
type ZipReturn2<A, B> = AFR<ReadonlyArray<readonly [A, B]>>;
type ZipReturn1<A, B> = AFR<(_: ZipArg2<B>) => ZipReturn2<A, B>>;
type Zip<A, B> = (arg1: ZipArg1<A>) => ZipReturn1<A, B>;

const zip =
  async <A, B>({ namedInputs: xs }: ZipArg1<A>): ZipReturn1<A, B> =>
  async ({ namedInputs: ys }: ZipArg2<B>): ZipReturn2<A, B> =>
    readonlyArray.zip(xs, ys);

//----------------------------------------------------------------------
const arrayAgent: AgentFunction<object, Response> = async () => ({
  size,
  reduce,
  flatMap,
  map,
  filter,
  find,
  some,
  every,
  concat,
  splitAt,
  head,
  tail,
  sort,
  range,
  zip,
});

export const arrayAgentInfo: AgentFunctionInfo = {
  name: 'arrayAgent',
  agent: arrayAgent,
  mock: arrayAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
