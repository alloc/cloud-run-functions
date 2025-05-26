import functions, { Request, Response } from '@google-cloud/functions-framework'
import esbuild from 'esbuild'
import { findUpSync } from 'find-up-simple'
import os from 'node:os'
import path from 'node:path'
import { isNumber, timeout, toResult } from 'radashi'
import { loadConfig } from '../config'
import { emptyDir } from '../utils/emptyDir'
import { hash } from '../utils/hash'

async function createBuild() {
  // The directory from which the dev command was run.
  const callerDir = process.env.CALLER_DIR ?? ''

  // The directory to start the config search from.
  const searchDir = process.env.CRF_ROOT
    ? path.resolve(callerDir, process.env.CRF_ROOT)
    : callerDir

  const config = loadConfig(searchDir)

  // The directory to search for entry points.
  const root = config.configDir
    ? path.resolve(config.configDir, config.root ?? '')
    : searchDir

  let pendingBuild: PromiseWithResolvers<
    esbuild.BuildResult<{ metafile: true }>
  >

  const entryPoints: string[] = []
  const requiredSuffix = config.entrySuffix?.replace(/^\.?/, '.') ?? ''
  const knownSuffixes = new Set<string>()

  for (const glob of config.globs ?? ['**/*']) {
    let ext = path.extname(glob)
    if (ext) {
      knownSuffixes.add(requiredSuffix + ext)
      entryPoints.push(
        requiredSuffix ? glob.replace(ext, requiredSuffix + ext) : glob
      )
      continue
    }
    for (ext of config.extensions ?? ['.ts', '.js']) {
      ext = requiredSuffix + ext
      knownSuffixes.add(ext)
      entryPoints.push(glob + ext)
    }
  }

  const knownSuffixesRE = new RegExp(
    `(${Array.from(knownSuffixes, e => e.replace(/\./g, '\\.'))
      .sort((a, b) => b.length - a.length)
      .join('|')})$`
  )

  const nodeModulesDir = findUpSync('node_modules', {
    cwd: root,
    type: 'directory',
  })

  const outDir = emptyDir(
    nodeModulesDir
      ? path.join(nodeModulesDir, `.cache/cloud-run-functions-${hash(root, 8)}`)
      : path.join(os.tmpdir(), `cloud-run-functions-${hash(root, 8)}`)
  )

  console.log({
    root,
    outDir,
    entryPoints,
    knownSuffixesRE,
  })

  const context = await esbuild.context({
    entryPoints,
    absWorkingDir: root,
    outdir: outDir,
    bundle: true,
    format: 'esm',
    packages: nodeModulesDir ? 'external' : 'bundle',
    sourcemap: true,
    metafile: true,
    logOverride: {
      'empty-glob': 'silent',
    },
    plugins: [
      {
        name: 'build-status',
        setup(build) {
          build.onStart(() => {
            pendingBuild = Promise.withResolvers()
          })
          build.onEnd(result => {
            pendingBuild.resolve(result)
          })
        },
      },
    ],
  })

  await context.watch()
  console.log('[esbuild] Watching for changes...')

  // Try loading a .env file if one exists and the dotenv package is installed.
  try {
    const dotenv = await import('dotenv')
    dotenv.config()
  } catch {}

  type TaskState = {
    running: number
    queue: PromiseWithResolvers<void>[]
  }

  const taskStates = new Map<string, TaskState>()

  type TaskHandler = (req: Request, res: Response) => unknown

  return {
    async match(url: URL): Promise<TaskHandler | null> {
      const result = await pendingBuild.promise
      for (const [file, output] of Object.entries(
        result.metafile?.outputs ?? {}
      )) {
        if (!output.entryPoint) {
          continue
        }
        const taskName = output.entryPoint.replace(knownSuffixesRE, '')
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

          const taskPath = path.join(root, file) + '?t=' + Date.now()
          const taskModule = await import(taskPath)
          const taskHandler = taskModule.default

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
