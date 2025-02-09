import fs from 'fs';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { compileFromFile } from './lib/compiler';
import { runFromJson } from './lib/run';
import { agents } from './agents';

type Argv = Readonly<{
  _: readonly string[];
  $0: string;
  file: string;
  json: boolean;
}>;

dotenv.config();

const main = async () => {
  const cmds = yargs(hideBin(process.argv))
    .command('compile <file>', 'Compile a source file writen in DSL', yargs => {
      yargs.positional('file', {
        type: 'string',
        describe: 'The file to be compiled',
        demandOption: true,
      });
    })
    .command('run <file>', 'Run a source file writen in DSL or JSON', yargs => {
      yargs.positional('file', {
        type: 'string',
        describe: 'The file to run',
        demandOption: true,
      });
      yargs.option('json', {
        alias: 'j',
        description: 'The file is a JSON file',
        type: 'boolean',
      });
    })
    .help();

  const argv = cmds.parse() as unknown as Argv;

  if (argv._[0] === 'compile') {
    console.log(JSON.stringify(await compileFromFile(argv.file, agents), null, 2));
  } else if (argv._[0] === 'run') {
    const json = argv.json
      ? JSON.parse(await fs.promises.readFile(argv.file, 'utf-8'))
      : await compileFromFile(argv.file, agents);
    await runFromJson(json, agents);
  } else {
    cmds.showHelp();
  }
};

main().catch(console.error);
