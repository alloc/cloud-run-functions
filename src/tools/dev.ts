import { findUpSync } from 'find-up-simple'
import path from 'node:path'
import $ from 'picospawn'

/**
 * Start the development server in a separate process.
 */
export function dev(root?: string) {
  const packageDir = findUpSync('dist', {
    cwd: import.meta.dirname,
    type: 'directory',
  })!

  const source = path.join(packageDir, 'targets/dev.js')
  const binDir = path.resolve(packageDir, '../node_modules/.bin')

  return $('functions-framework --target=dev --source', [source], {
    stdio: 'inherit',
    env: {
      ...process.env,
      CRF_ROOT: root,
      CALLER_DIR: process.cwd(),
      PATH: `${binDir}:${process.env.PATH}`,
    },
  })
}
