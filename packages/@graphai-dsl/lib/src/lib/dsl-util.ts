import { pipe } from 'fp-ts/lib/function';
import { Json } from './compiler';
import { readonlyArray, readonlyRecord } from 'fp-ts';
import {
  AgentCall,
  AgentDef,
  ArrayAt,
  ComputedNode,
  DSLArray,
  DSLBoolean,
  DSLNull,
  DSLNumber,
  DSLObject,
  DSLString,
  Equality,
  Graph,
  Identifier,
  IfThenElse,
  Modifier,
  NestedGraph,
  ObjectMember,
  Paren,
  TryCatch,
} from './dsl-syntax-tree';
import { ParserRange } from './parser-combinator';

const defineConstrucor =
  <T>(type: string) =>
  (params: Omit<T, 'type' | 'context'>, context: ParserRange): T =>
    ({
      type,
      context,
      ...params,
    }) as T;

export const newIdentifier = defineConstrucor<Identifier>('Identifier');
export const newNumber = defineConstrucor<DSLNumber>('Number');
export const newString = defineConstrucor<DSLString>('String');
export const newBoolean = defineConstrucor<DSLBoolean>('Boolean');
export const newArray = defineConstrucor<DSLArray>('Array');
export const newObject = defineConstrucor<DSLObject>('Object');
export const newNull = defineConstrucor<DSLNull>('Null');
export const newArrayAt = defineConstrucor<ArrayAt>('ArrayAt');
export const newObjectMember = defineConstrucor<ObjectMember>('ObjectMember');
export const newAgentCall = defineConstrucor<AgentCall>('AgentCall');
export const newAgentDef = defineConstrucor<AgentDef>('AgentDef');
export const newModifier = defineConstrucor<Modifier>('Modifier');
export const newEquality = defineConstrucor<Equality>('Equality');
export const newIfThenElse = defineConstrucor<IfThenElse>('IfThenElse');
export const newTryCatch = defineConstrucor<TryCatch>('TryCatch');
export const newParen = defineConstrucor<Paren>('Paren');
export const newComputedNode = defineConstrucor<ComputedNode>('ComputedNode');
export const newNestedGraph = defineConstrucor<NestedGraph>('NestedGraph');
export const newGraph = defineConstrucor<Graph>('Graph');

export const newError = (message: DSLString, context: ParserRange): DSLObject =>
  newObject(
    {
      value: [
        {
          key: newIdentifier({ name: '__type__' }, context),
          value: newString({ value: ['ERROR'] }, context),
        },
        {
          key: newIdentifier({ name: 'message' }, context),
          value: message,
        },
      ],
    },
    context,
  );

export const toReadableJson = (value: Json): Json =>
  typeof value === 'number' ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  value == null
    ? value
    : value instanceof Array
      ? value.map(toReadableJson)
      : pipe(
          readonlyRecord.toEntries(value),
          readonlyArray.reduce({}, (obj, [k, v]) =>
            k === 'context' || (k === 'annotations' && v instanceof Array && v.length === 0)
              ? obj
              : { ...obj, [k]: toReadableJson(v) },
          ),
        );
