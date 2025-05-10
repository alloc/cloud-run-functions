import * as ordana from 'ordana'

const command = ordana.parse(process.argv.slice(2), {
  name: 'cloud-run-functions',
  subcommands: {
    dev: {
      description: 'Start the development server',
      positionals: { maximum: 1 },
    },
    build: {
      description: 'Generate a bundle for each function',
      positionals: { maximum: 1 },
    },
  },
})

if (command.type === 'help') {
  console.log(ordana.generateHelpMessage(command))
} else {
  const subcommands = {
    async dev() {
      const { dev } = await import('./tools/dev')
      await dev(command.positionals[0])
    },
    async build() {
      throw new Error('Not implemented')
    },
  }
  await subcommands[command.subcommand]()
}
