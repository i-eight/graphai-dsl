import { GraphAI } from 'graphai/lib/graphai';
import { GraphData } from 'graphai/lib/type';
import fs from 'fs';
import process from 'process';
import { pipe } from 'fp-ts/lib/function';
import { parser } from './lib/parser-combinator';
import { file } from './lib/dsl-parser';
import { stream } from './lib/stream';
import { either } from 'fp-ts';
import { compiler } from '../src/lib';
import { agents } from './agents';
import dotenv from 'dotenv';

dotenv.config();

const main = async () => {
  if (process.argv.length < 3) {
    console.error('Usage: graphai-dsl <filename>');
    process.exit(1);
  }
  const srcFile = process.argv[2];
  const src = await fs.promises.readFile(srcFile, 'utf-8');
  pipe(
    file,
    parser.run(stream.create(src)),
    either.flatMap(({ data }) => pipe(compiler.graphToJson(data), compiler.run)),
    either.match(
      e => {
        console.error(e);
        process.exit(1);
      },
      ([_]) => _.json,
    ),
    async json => {
      console.log(JSON.stringify(json, null, 2));
      await new GraphAI(json as GraphData, agents).run();
    },
  );
  //
};

main();
