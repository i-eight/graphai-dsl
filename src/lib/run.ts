import { GraphAI, GraphData } from 'graphai';
import { Json } from './compiler';
import { agents } from '../agents';

export const runFromJson = async (json: Json) => new GraphAI(json as GraphData, agents).run();
