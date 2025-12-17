import 'source-map-support/register.js'

import functions, {
  type Request,
  type Response,
} from '@google-cloud/functions-framework'
import esbuild from 'esbuild'
import { findUpSync } from 'find-up-simple'
import fs from 'node:fs'
import { Module } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { isNumber, timeout, toResult } from 'radashi'
import { emptyDir } from '../common/emptyDir'
import { getFunctionFilter } from '../common/functionFilter'
import { hash } from '../common/hash'
import { loadConfig } from '../config'
import type { BuildOptions } from '../tools/build'

async function createBuild() {
  const options = JSON.parse(process.env.CRF_OPTIONS!) as BuildOptions & {
    /** The directory from which the dev command was run. */
    workingDir: string
    /** The directory to start the config search from. */
    searchDir?: string
  }

  const searchDir = path.resolve(options.workingDir, options.searchDir ?? '')
  const config = loadConfig(searchDir)

  // The directory to search for entry points.
  const root = config.configDir
    ? path.resolve(config.configDir, config.root ?? '')
    : searchDir

  const functionFilter = getFunctionFilter(config)

  // You should avoid setting the cache directory to a path within a
  // "node_modules" directory, because this prevents Vitest from loading
  // sourcemaps.
  const cacheDir = emptyDir(
    path.join(
      fs.realpathSync(os.tmpdir()),
      'cloud-run-functions-' + hash(root, 8)
    )
  )

  type BuildResult = esbuild.BuildResult<{ metafile: true }>

  let pendingBuild: PromiseWithResolvers<BuildResult> | undefined
  let finishedBuild: BuildResult | undefined

  const context = await esbuild.context({
    entryPoints: functionFilter.globs,
    absWorkingDir: root,
    outdir: cacheDir,
    define: options.define,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    packages: 'bundle',
    sourcemap: true,
    sourcesContent: false,
    metafile: true,
    logOverride: {
      'empty-glob': 'silent',
    },
    plugins: [
      {
        name: 'build-status',
        setup(build) {
          pendingBuild = Promise.withResolvers()
          build.onStart(() => {
            pendingBuild ??= Promise.withResolvers()
          })
          build.onEnd(result => {
            if (pendingBuild) {
              pendingBuild.resolve(result)
              pendingBuild = undefined
            }
            finishedBuild = result
          })
        },
      },
    ],
  })

  await context.watch()
  console.log('[esbuild] Watching for changes...')

  // Try loading a .env file if one exists and the dotenv package is installed.
  const envPath = findUpSync('.env', { cwd: root })
  if (envPath) {
    try {
      const dotenv = await import('dotenv')
      dotenv.config({ path: envPath })
      console.log('[dotenv] Environment variables loaded.')
    } catch {}
  }

  type TaskState = {
    running: number
    queue: PromiseWithResolvers<void>[]
  }

  const taskStates = new Map<string, TaskState>()

  type TaskHandler = (req: Request, res: Response) => unknown

  return {
    async match(url: URL): Promise<TaskHandler | null> {
      const result = (await pendingBuild?.promise) ?? finishedBuild
      if (!result) {
        return null
      }

      for (const [file, output] of Object.entries(
        result.metafile?.outputs ?? {}
      )) {
        if (!output.entryPoint) {
          continue
        }
        const taskName = output.entryPoint.replace(
          functionFilter.suffixPattern,
          ''
        )
        if (url.pathname === '/' + taskName) {
          const taskState = taskStates.get(taskName) ?? {
            running: 0,
            queue: [],
          }

          const taskConcurrency = isNumber(config.maxInstanceConcurrency)
            ? config.maxInstanceConcurrency
            : (config.maxInstanceConcurrency?.[taskName] ?? 5)

          if (taskState.running >= taskConcurrency) {
            // Wait up to 30 seconds for a slot to open up.
            const ticket = Promise.withResolvers<void>()
            taskState.queue.push(ticket)
            const [error] = await toResult(
              Promise.race([ticket.promise, timeout(30_000)])
            )
            // If the ticket is not resolved within 30 seconds, return a 429.
            if (error) {
              return (_req, res) => {
                res.status(429).end()
              }
            }
          }

          taskState.running++
          taskStates.set(taskName, taskState)

          const require = Module.createRequire(import.meta.filename)

          let taskHandler = require(path.join(root, file))
          while (taskHandler && typeof taskHandler !== 'function') {
            taskHandler = taskHandler.default
          }
          if (!taskHandler) {
            return () => {
              throw new Error(`Task ${taskName} is not a function.`)
            }
          }

          switch (config.adapter) {
            case 'hattip': {
              const { createMiddleware } = await import('@hattip/adapter-node')
              taskHandler = createMiddleware(taskHandler)
            }
          }

          return (req, res) => {
            const end = res.end.bind(res)
            res.end = (...args: any[]) => {
              taskState.running--
              taskState.queue.shift()?.resolve()
              return end(...args)
            }
            return taskHandler(req, res)
          }
        }
      }
      return null
    },
  }
}

const buildPromise = createBuild()

functions.http('dev', async (req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host)
  const build = await buildPromise
  const handler = await build.match(url)

  if (handler) {
    try {
      await handler(req, res)
    } catch (error) {
      console.error(error)
      res.status(500).end()
    }
  } else {
    res.status(404).end()
  }
})
