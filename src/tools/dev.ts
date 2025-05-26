import { findUpSync } from 'find-up-simple'
import path from 'node:path'
import $, { PicospawnOptions } from 'picospawn'

export type DevOptions = PicospawnOptions & {
  port?: string | number
}

/**
 * Start the development server in a separate process.
 */
export function dev(root?: string, { port, ...options }: DevOptions = {}) {
  const packageDir = findUpSync('dist', {
    cwd: import.meta.dirname,
    type: 'directory',
  })!

  const source = path.join(packageDir, 'targets/dev.js')
  const binDir = path.resolve(packageDir, '../node_modules/.bin')

  return $(
    'functions-framework --target=dev --source %s',
    [source, port != null && ['--port', port.toString()]],
    {
      stdio: 'inherit',
      ...options,
      env: {
        ...(options.env ?? process.env),
        CRF_OPTIONS: JSON.stringify({
          searchDir: root,
          workingDir: process.cwd(),
        }),
        PATH: `${binDir}:${process.env.PATH}`,
      },
    }
  )
}
