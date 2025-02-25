import { Either } from 'fp-ts/lib/Either';
import { Position, Source, stream, Stream } from './stream';
import { either, option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { Option } from 'fp-ts/lib/Option';
import { Unit, unit as unit_ } from './unit';
import { loop, Recur, recur } from './loop';
import { BaseError, mergeParserError, ParserError } from './error';

export type ParserData<A> = Readonly<{
  state: ParserState;
  data: A;
}>;

export type ParserState = Readonly<{
  stream: Stream;
  error?: ParserError;
}>;

export type ParserResult<A> = Either<ParserError, ParserData<A>>;

export type Parser<A> = Readonly<{
  parse: (state: ParserState) => ParserResult<A>;
}>;

export type ParserRange = Readonly<{
  source: Source;
  start: Position;
  end: Position;
}>;

export namespace parser {
  export const create = <A>(parse: (state: ParserState) => ParserResult<A>): Parser<A> => ({
    parse,
  });

  export const of = <A>(data: A): Parser<A> => create(state => either.right({ state, data }));

  export const fail = <A>(error: BaseError): Parser<A> =>
    create(s =>
      either.left({
        source: s.stream.source,
        position: s.stream.position,
        ...error,
      } satisfies ParserError),
    );

  export const run =
    <A>(_: ParserState | Stream) =>
    (self: Parser<A>): ParserResult<A> =>
      self.parse(stream.is(_) ? { stream: _ } : _);

  export const flatMap =
    <A, B>(f: (a: A) => Parser<B>) =>
    (self: Parser<A>): Parser<B> =>
      create(s =>
        pipe(
          self,
          run(s),
          either.flatMap(({ state, data }) =>
            pipe(
              f(data),
              run(state),
              either.orElse(e =>
                either.left<ParserError, ParserData<B>>(
                  state.error == null
                    ? e
                    : state.error.position.index > e.position.index
                      ? state.error
                      : e,
                ),
              ),
            ),
          ),
        ),
      );

  export const tap =
    <A, B>(f: (a: A) => Parser<B>) =>
    (self: Parser<A>): Parser<A> =>
      pipe(
        self,
        flatMap(a =>
          pipe(
            f(a),
            map(() => a),
          ),
        ),
      );

  export const map =
    <A, B>(f: (a: A) => B) =>
    (self: Parser<A>): Parser<B> =>
      pipe(
        self,
        flatMap(a => of(f(a))),
      );

  export const unit: Parser<Unit> = of({ type: 'Unit' });

  export const bind =
    <N extends string, A, B>(name: Exclude<N, keyof A>, f: (a: A) => Parser<B>) =>
    (self: Parser<A>): Parser<Readonly<{ [K in keyof A | N]: K extends keyof A ? A[K] : B }>> =>
      pipe(
        self,
        flatMap(a =>
          pipe(
            f(a),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map(b => ({ ...a, [name]: b }) as any),
          ),
        ),
      );

  export const orElse =
    <A>(f: (error: ParserError) => Parser<A>) =>
    (self: Parser<A>): Parser<A> =>
      create(s =>
        pipe(
          self,
          run(s),
          either.orElse(e1 =>
            pipe(
              f(e1),
              run(s),
              either.flatMap(_ =>
                either.right<ParserError, ParserData<A>>({
                  ..._,
                  state: {
                    ..._.state,
                    error:
                      _.state.error == null
                        ? e1
                        : _.state.error.position.index > e1.position.index
                          ? _.state.error
                          : e1,
                  },
                }),
              ),
            ),
          ),
        ),
      );

  export const or =
    <A>(p: Parser<A> | (() => Parser<A>)) =>
    (self: Parser<A>): Parser<A> =>
      pipe(
        self,
        orElse(e1 =>
          pipe(
            typeof p === 'function' ? p() : p,
            orElse(e2 => fail(mergeParserError(e1, e2))),
          ),
        ),
      );

  export const optional = <A>(self: Parser<A>): Parser<Option<A>> =>
    pipe(
      self,
      map(a => option.some(a)),
      orElse(() => of<Option<A>>(option.none)),
    );

  export const getState: Parser<ParserState> = create(state =>
    either.right({ state, data: state }),
  );

  export const updateState = (f: (state: ParserState) => ParserState): Parser<Unit> =>
    create(state => either.right({ state: f(state), data: unit_ }));

  export const getStream: Parser<Stream> = pipe(
    getState,
    map(s => s.stream),
  );

  export const mapWithRange =
    <A, B>(f: (a: A, context: ParserRange) => B) =>
    (self: Parser<A>): Parser<B> =>
      pipe(
        unit,
        bind('start', () => getStream),
        bind('a', () => self),
        bind('end', () => getStream),
        map(({ start, a, end }) =>
          f(a, { source: start.source, start: start.position, end: end.position }),
        ),
      );

  export const range =
    <A, B>(f: (a: A) => B) =>
    (self: Parser<A>): Parser<B & Readonly<{ context: ParserRange }>> =>
      pipe(
        self,
        mapWithRange((a, context) => ({
          ...f(a),
          context,
        })),
      );

  export const notFollowedBy = <A>(self: Parser<A>): Parser<Unit> =>
    create(s =>
      pipe(
        self,
        run(s),
        either.match(
          () => either.right({ state: s, data: { type: 'Unit' } }),
          a =>
            either.left({
              type: 'UnexpectedParserError',
              message: `Expect not followed by ${a}`,
              source: s.stream.source,
              position: s.stream.position,
            }),
        ),
      ),
    );

  export const left =
    <A, B>(p: Parser<B>) =>
    (self: Parser<A>): Parser<A> =>
      pipe(
        self,
        flatMap(a =>
          pipe(
            p,
            map(_ => a),
          ),
        ),
      );

  export const right =
    <A, B>(p: Parser<B>) =>
    (self: Parser<A>): Parser<B> =>
      pipe(
        self,
        flatMap(_ =>
          pipe(
            p,
            map(b => b),
          ),
        ),
      );

  export const repeat = <A>(init: A, f: (acc: A) => Parser<A>) =>
    create<A>(s =>
      pipe(
        loop({ state: s, data: init }, result =>
          pipe(
            f(result.data),
            run(result.state),
            either.match(
              () =>
                ({
                  state: result.state,
                  data: result.data,
                }) as Recur<ParserData<A>> | ParserData<A>,
              ({ state, data }) => recur({ state, data }),
            ),
          ),
        ),
        either.right,
      ),
    );

  export const repeat1 = <A>(init: A, f: (acc: A) => Parser<A>) =>
    pipe(
      f(init),
      flatMap(a => repeat(a, f)),
    );

  export const many = <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
    repeat<ReadonlyArray<A>>([], (xs: ReadonlyArray<A>) =>
      pipe(
        self,
        map(a => [...xs, a]),
      ),
    );

  export const many1 = <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
    pipe(
      self,
      flatMap(a =>
        pipe(
          many(self),
          map(as => [a, ...as]),
        ),
      ),
    );

  export const startBy =
    <B>(delim: Parser<B>) =>
    <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
      pipe(
        delim,
        flatMap(_ => self),
        many,
      );

  export const sepBy1 =
    <B>(delim: Parser<B>) =>
    <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
      pipe(
        self,
        flatMap(a =>
          pipe(
            self,
            startBy(delim),
            map(xs => [a, ...xs]),
          ),
        ),
      );

  export const sepBy =
    <B>(delim: Parser<B>) =>
    <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
      pipe(
        self,
        sepBy1(delim),
        orElse(() => of<ReadonlyArray<A>>([])),
      );
}
