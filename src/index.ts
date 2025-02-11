import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runFromFile, compileFromFile } from './lib/run';
import { apply, pipe } from 'fp-ts/lib/function';
import { unit } from './lib/unit';

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
    compileFromFile(argv.file);
  } else if (argv._[0] === 'run') {
    pipe(runFromFile(argv.file, { json: argv.json }), apply(unit));
  } else {
    cmds.showHelp();
  }
};

main().catch(console.error);
