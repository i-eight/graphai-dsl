import { ParserContext as Context } from './parser-combinator';

export type File = Graph;

export type Graph = Readonly<{
  type: 'Graph';
  statements: ReadonlyArray<Node>;
  context: Context;
}>;

export type NestedGraph = Readonly<{
  type: 'NestedGraph';
  annotations: ReadonlyArray<NodeAnnotation>;
  graph: Graph;
  context: Context;
}>;

export type Node = StaticNode | ComputedNode;

export type StaticNode = Readonly<{
  type: 'StaticNode';
  name: Identifier;
  value: Expr;
  context: Context;
}>;

export type ComputedNodeBodyExpr =
  | ComputedNodeBodyParen
  | IfThenElse
  | AgentDef
  | BinaryTerm
  | ArrayAt
  | ObjectMember
  | AgentCall
  | DSLString;

export type ComputedNodeBody = NestedGraph | ComputedNodeBodyExpr;

export type ComputedNode = Readonly<{
  type: 'ComputedNode';
  name?: Identifier;
  body: ComputedNodeBody;
  context: Context;
}>;

export type Expr =
  | IfThenElse
  | Paren
  | Identifier
  | Literal
  | ArrayAt
  | ObjectMember
  | AgentCall
  | AgentDef
  | BinaryTerm;

export type IfThenElse = Readonly<{
  type: 'IfThenElse';
  annotations: ReadonlyArray<NodeAnnotation>;
  if: ComputedNodeBody;
  then: ComputedNodeBody;
  else: ComputedNodeBody;
  context: Context;
}>;

export type Paren = Readonly<{
  type: 'Paren';
  annotations: ReadonlyArray<NodeAnnotation>;
  expr: Expr;
  context: Context;
}>;

export type ComputedNodeBodyParen = Readonly<{
  type: 'ComputedNodeBodyParen';
  annotations: ReadonlyArray<NodeAnnotation>;
  expr: ComputedNodeBody;
  context: Context;
}>;

export type Identifier = Readonly<{
  type: 'Identifier';
  annotations: ReadonlyArray<NodeAnnotation>;
  name: string;
  context: Context;
}>;

export type Literal =
  | DSLNumber
  | RawString
  | DSLString
  | DSLBoolean
  | DSLArray
  | DSLObject
  | DSLNull;

export type DSLNumber = Readonly<{ type: 'Number'; value: number; context: Context }>;

export type RawString = Readonly<{ type: 'RawString'; value: string; context: Context }>;

export type DSLString = Readonly<{
  type: 'String';
  value: ReadonlyArray<string | Expr>;
  context: Context;
}>;

export type DSLBoolean = Readonly<{ type: 'Boolean'; value: boolean; context: Context }>;

export type DSLArray = Readonly<{ type: 'Array'; value: ReadonlyArray<Expr>; context: Context }>;

export type DSLObjectPair = Readonly<{ key: Identifier; value: Expr }>;

export type DSLObject = Readonly<{
  type: 'Object';
  value: ReadonlyArray<DSLObjectPair>;
  context: Context;
}>;

export type DSLNull = Readonly<{ type: 'Null'; context: Context }>;

export type ArrayAt = Readonly<{
  type: 'ArrayAt';
  annotations: ReadonlyArray<NodeAnnotation>;
  array: DSLArray | Paren | Identifier | AgentCall;
  index: Expr;
  context: Context;
}>;

export type ObjectMember = Readonly<{
  type: 'ObjectMember';
  annotations: ReadonlyArray<NodeAnnotation>;
  object: DSLObject | Paren | Identifier | AgentCall;
  key: Identifier;
  context: Context;
}>;

export type NodeAnnotation = Readonly<{
  type: 'NodeAnnotation';
  name: Identifier;
  value: Expr;
  context: Context;
}>;

export type AgentCall = Readonly<{
  type: 'AgentCall';
  annotations: ReadonlyArray<NodeAnnotation>;
  agent: Identifier;
  args?: Expr;
  context: Context;
}>;

export type AgentDef = Readonly<{
  type: 'AgentDef';
  annotations: ReadonlyArray<NodeAnnotation>;
  args?: Identifier;
  body: ComputedNodeBodyExpr | Graph;
  context: Context;
}>;

export type Destruction = ArrayDestruction | ObjectDestruction;

export type ArrayDestruction = Readonly<{
  type: 'ArrayDestruction';
  elements: ReadonlyArray<Identifier | Destruction>;
  context: Context;
}>;

export type ObjectDestruction = Readonly<{
  type: 'ObjectDestruction';
  keys: ReadonlyArray<
    Readonly<{
      key: Identifier;
      value?: Identifier | Destruction;
    }>
  >;
  context: Context;
}>;

export type PowerBase = DSLNumber | Identifier | Paren | ArrayAt | ObjectMember | AgentCall;

export type Power = Readonly<{
  type: 'Power';
  annotations: ReadonlyArray<NodeAnnotation>;
  base: PowerBase | Power;
  exponent: DSLNumber;
  context: Context;
}>;

export type TermMulDivMod = PowerBase | Power;

export type MulDivMod = Readonly<{
  type: 'MulDivMod';
  annotations: ReadonlyArray<NodeAnnotation>;
  left: TermMulDivMod | MulDivMod;
  operator: '*' | '/' | '%';
  right: TermMulDivMod;
  context: Context;
}>;

export type TermPlusMinus = TermMulDivMod | MulDivMod;

export type PlusMinus = Readonly<{
  type: 'PlusMinus';
  annotations: ReadonlyArray<NodeAnnotation>;
  left: TermPlusMinus | PlusMinus;
  operator: '+' | '-';
  right: TermPlusMinus;
  context: Context;
}>;

export type TermCompare = TermPlusMinus | PlusMinus | DSLBoolean;

export type Compare = Readonly<{
  type: 'Compare';
  annotations: ReadonlyArray<NodeAnnotation>;
  left: TermCompare | Compare;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=';
  right: TermCompare;
  context: Context;
}>;

export type TermLogical = TermCompare | Compare;

export type Logical = Readonly<{
  type: 'Logical';
  annotations: ReadonlyArray<NodeAnnotation>;
  left: TermLogical | Logical;
  operator: '&&' | '||';
  right: TermLogical;
  context: Context;
}>;

export type BinaryTerm = TermLogical | Logical;

export type BlockComment = Readonly<{
  type: 'BlockComment';
  value: string;
  context: Context;
}>;

export type LineComment = Readonly<{
  type: 'LineComment';
  value: string;
  context: Context;
}>;
