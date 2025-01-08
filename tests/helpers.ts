import { pipe } from 'fp-ts/lib/function';
import {
  NestedGraph,
  ComputedNode,
  Expr,
  Graph,
  NodeAnnotation,
  StaticNode,
  ComputedNodeBody,
} from '../src/lib/dsl-syntax-tree';
import { CompileError } from '../src/lib/compiler';
import { either, readonlyArray } from 'fp-ts';
import { Either } from 'fp-ts/lib/Either';

export const printJson = (json: unknown): void => console.log(JSON.stringify(json, null, 2));

export const toTupleFromExpr = (
  _: Expr | Graph | NestedGraph | NodeAnnotation | StaticNode | ComputedNode | ComputedNodeBody,
): unknown => {
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
        ? { annotations: _.annotations.map(toTupleFromExpr), agent: _.agent.name }
        : {
            annotations: _.annotations.map(toTupleFromExpr),
            agent: _.agent.name,
            args: toTupleFromExpr(_.args),
          };
    case 'AgentDef':
      return {
        def: _.args?.name,
        body: toTupleFromExpr(_.body),
      };
    case 'Logical':
    case 'Compare':
    case 'PlusMinus':
    case 'MulDivMod':
      return [toTupleFromExpr(_.left), _.operator, toTupleFromExpr(_.right)];
    case 'Power':
      return [toTupleFromExpr(_.base), '^', _.exponent.value];
    case 'StaticNode':
      return { staticNode: _.name.name, value: toTupleFromExpr(_.value) };
    case 'ComputedNode':
      return _.name
        ? { computedNode: _.name.name, body: toTupleFromExpr(_.body) }
        : { anonNode: toTupleFromExpr(_.body) };
    case 'NestedGraph':
      return { annotations: _.annotations.map(toTupleFromExpr), nested: toTupleFromExpr(_.graph) };
    case 'Graph':
      return _.statements.map(toTupleFromExpr);
  }
};

export const toTupleFromCompileError = (
  _: Readonly<{ type: string }>,
): Either<[string, string], unknown> => either.left([_.type, (_ as CompileError).items[0].message]);
