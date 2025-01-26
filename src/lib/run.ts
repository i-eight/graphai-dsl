import { AgentFunctionInfoDictionary, GraphData } from 'graphai/lib/type';
import { Json } from './compiler';
import { GraphAI } from 'graphai/lib/graphai';

export const runFromJson = async (json: Json, agents: AgentFunctionInfoDictionary) =>
  new GraphAI(json as GraphData, agents).run();
