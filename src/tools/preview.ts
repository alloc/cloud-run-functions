import { findUpSync } from 'find-up-simple'
import path from 'node:path'
import $, { PicospawnOptions } from 'picospawn'

export interface PreviewOptions extends PicospawnOptions {
  /**
   * The directory containing the bundled output.
   * @default "dist"
   */
  outDir?: string
}

/**
 * Start the preview server for the bundled output.
 */
export function preview({ outDir, ...options }: PreviewOptions = {}) {
  const packageDir = findUpSync('dist', {
    cwd: import.meta.dirname,
    type: 'directory',
  })!

  const binDir = path.resolve(packageDir, '../node_modules/.bin')
  const sourceDir = path.resolve(process.cwd(), outDir ?? 'dist')
  const source = path.join(sourceDir, 'index.js')

  return $(
    'functions-framework --target=build --source %s',
    [source],
    {
      stdio: 'inherit',
      ...options,
      env: {
        ...(options.env ?? process.env),
        PATH: `${binDir}:${process.env.PATH}`,
      },
    }
  )
}
