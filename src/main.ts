import {
  command,
  option,
  optional,
  positional,
  run,
  string,
  subcommands,
} from 'cmd-ts'

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
  },
  async handler({ root, port }) {
    const { dev } = await import('./tools/dev')
    await dev(root, { port })
  },
})

const build = command({
  name: 'build',
  description: 'Generate a bundle for each function',
  args: {
    root: positional({
      type: optional(string),
      displayName: 'root',
      description: 'Directory to search for function entrypoints',
    }),
  },
  async handler() {
    throw new Error('Not implemented')
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
