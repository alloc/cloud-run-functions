import {
  array,
  command,
  multioption,
  option,
  optional,
  positional,
  run,
  string,
  subcommands,
} from 'cmd-ts'
import { parseDefines } from './common/parseDefines'

const dev = command({
  name: 'dev',
  description: 'Start the development server',
  args: {
    root: positional({
      type: optional(string),
      displayName: 'root',
      description: 'Directory to search for function entrypoints',
    }),
    port: option({
      type: optional(string),
      long: 'port',
      short: 'p',
      description: 'The port to use for the development server',
    }),
    define: multioption({
      type: optional(array(string)),
      long: 'define',
      short: 'd',
      description: 'Statically replace specific variables in the source code',
    }),
  },
  async handler({ root, port, define }) {
    const { dev } = await import('./tools/dev')
    await dev(root, {
      port,
      define: parseDefines(define),
    })
  },
})

const build = command({
  name: 'build',
  description: 'Bundle your functions for deployment',
  args: {
    root: positional({
      type: optional(string),
      displayName: 'root',
      description: 'Directory to search for function entrypoints',
    }),
    outdir: option({
      type: optional(string),
      long: 'outdir',
      short: 'o',
      description: 'The directory to write bundled output to',
    }),
    define: multioption({
      type: optional(array(string)),
      long: 'define',
      short: 'd',
      description: 'Statically replace specific variables in the source code',
    }),
  },
  async handler({ root, outdir, define }) {
    const { build } = await import('./tools/build')
    await build(root, {
      outdir,
      define: parseDefines(define),
    })
  },
})

const cli = subcommands({
  name: 'cloud-run-functions',
  cmds: {
    dev,
    build,
  },
})

await run(cli, process.argv.slice(2))
