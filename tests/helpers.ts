import { pipe } from 'fp-ts/lib/function';
import {
  NestedGraph,
  ComputedNode,
  Expr,
  Graph,
  NodeAnnotation,
  StaticNode,
  ComputedNodeBody,
  File,
  Import,
  Statements,
  NativeImport,
} from '../src/lib/dsl-syntax-tree';
import { CompileError, Json } from '../src/lib/compiler';
import { either, readonlyArray } from 'fp-ts';
import { Either } from 'fp-ts/lib/Either';
import { runFromJson } from '../src/lib/run';
import { parser, ParserError } from '../src/lib/parser-combinator';
import { file } from '../src/lib/dsl-parser';
import { source, stream } from '../src/lib/stream';
import { compiler } from '../src/lib';
import { through } from '../src/lib/through';
import { agents } from '../src/agents';
import fs from 'fs';

export const printJson = (json: unknown): void => console.log(JSON.stringify(json, null, 2));

export const toTupleFromExpr = (
  _:
    | Expr
    | File
    | Import
    | NativeImport
    | Graph
    | Statements
    | NestedGraph
    | NodeAnnotation
    | StaticNode
    | ComputedNode
    | ComputedNodeBody,
): unknown => {
  if (_ instanceof Array) {
    return _.map(toTupleFromExpr);
  } else {
    switch (_.type) {
      case 'IfThenElse':
        return {
          if: toTupleFromExpr(_.if),
          then: toTupleFromExpr(_.then),
          else: toTupleFromExpr(_.else),
        };
      case 'Paren':
        return [toTupleFromExpr(_.expr)];
      case 'Identifier':
        return _.name;
      case 'Boolean':
      case 'Number':
        return _.value;
      case 'Null':
        return null;
      case 'String':
        return pipe(
          _.value,
          readonlyArray.map(_ => (typeof _ === 'string' ? _ : toTupleFromExpr(_))),
        );
      case 'Array':
        return _.value.map(toTupleFromExpr);
      case 'Object':
        return pipe(
          _.value.map(_ => [_.key.name, toTupleFromExpr(_.value)]),
          Object.fromEntries,
        );
      case 'ArrayAt':
        return { array: toTupleFromExpr(_.array), at: toTupleFromExpr(_.index) };
      case 'ObjectMember':
        return { object: toTupleFromExpr(_.object), member: _.key.name };
      case 'NodeAnnotation':
        return { annotation: _.name.name, value: toTupleFromExpr(_.value) };
      case 'AgentCall':
        return _.args == null
          ? { annotations: _.annotations.map(toTupleFromExpr), agent: toTupleFromExpr(_.agent) }
          : {
              annotations: _.annotations.map(toTupleFromExpr),
              agent: toTupleFromExpr(_.agent),
              args: toTupleFromExpr(_.args),
            };
      case 'AgentDef':
        return {
          def: _.args?.name,
          body: toTupleFromExpr(_.body),
        };
      case 'Pipeline':
      case 'Logical':
      case 'Equality':
      case 'Relational':
      case 'PlusMinus':
      case 'MulDivMod':
        return [toTupleFromExpr(_.left), _.operator, toTupleFromExpr(_.right)];
      case 'Power':
        return [toTupleFromExpr(_.base), '^', toTupleFromExpr(_.exponent)];
      case 'StaticNode':
        return { staticNode: _.name.name, value: toTupleFromExpr(_.value) };
      case 'ComputedNode':
        return _.name
          ? { computedNode: _.name.name, body: toTupleFromExpr(_.body) }
          : { anonNode: toTupleFromExpr(_.body) };
      case 'NestedGraph':
        return {
          annotations: _.annotations.map(toTupleFromExpr),
          nested: toTupleFromExpr(_.graph),
        };
      case 'Graph':
        return _.statements.map(toTupleFromExpr);
      case 'Import':
        return { import: _.path, as: _.as?.name };
      case 'NativeImport':
        return { import: _.path, as: _.as.name };
      case 'File':
        return {
          imports: _.imports?.map(toTupleFromExpr),
          graph: toTupleFromExpr(_.graph),
        };
    }
  }
};

export const toTupleFromCompileError = (
  _: CompileError,
): Either<[string, string | undefined], unknown> =>
  either.left([_.type, _.type === 'CompileError' ? _.items[0].message : _.message]);

export const parseFileTest = (path: string): Either<ParserError, File> =>
  pipe(fs.readFileSync(path, 'utf-8'), src => parseSourceTest(src, path));

export const parseSourceTest = (src: string, path: string = ''): Either<ParserError, File> =>
  pipe(
    file(path),
    parser.run(stream.create(source.of(path, src))),
    either.map(_ => _.data),
  );

export const compileFileTest =
  (result: Either<CompileError, Json> | undefined = undefined) =>
  (file: Either<ParserError, File>): Either<CompileError | ParserError, Json> =>
    pipe(
      file,
      either.flatMap(_ => pipe(_, compiler.fileToJson, compiler.run(agents))),
      either.map(([{ json }]) => json),
      through(_ => (result == null ? _ : expect(_).toStrictEqual(result))),
    );

export const runFileTest =
  (
    result:
      | Either<unknown, unknown>
      | ((f: Either<unknown, unknown>) => void)
      | undefined = undefined,
  ) =>
  (json: Either<unknown, Json>): Promise<void> =>
    pipe(json, async _ =>
      typeof result === 'function'
        ? result(_)
        : pipe(
            _,
            either.match(
              async e => expect(e).toStrictEqual(result),
              async _ => {
                await runFromJson(_, agents)
                  .catch(e => expect(either.left(e)).toStrictEqual(result))
                  .then(r => expect(either.right(r)).toStrictEqual(result));
              },
            ),
          ),
    );
