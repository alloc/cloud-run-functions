import esbuild from 'esbuild'
import { findUpSync } from 'find-up-simple'
import fs from 'node:fs'
import path from 'node:path'
import { glob } from 'tinyglobby'
import { getFunctionFilter } from '../common/functionFilter'
import { loadConfig } from '../config'

export type BuildOptions = {
  /**
   * Statically replace specific variables in the source code.
   *
   * ⚠️ The value must be valid JavaScript syntax!
   *
   * @example
   * ```ts
   * define: {
   *   'process.env.NODE_ENV': '"development"',
   * }
   * ```
   */
  define?: Record<string, string>
}

export type BundleOptions = BuildOptions & {
  /**
   * The directory to write the bundled output to.
   * @default "dist"
   */
  outdir?: string
}

type RouteEntry = {
  entry: string
  name: string
  path: string
}

const virtualModuleId = 'virtual:cloud-run-functions'
const virtualModuleNamespace = 'crf-functions'

export async function build(
  root?: string,
  { define, outdir }: BundleOptions = {}
) {
  const workingDir = process.cwd()
  const searchDir = path.resolve(workingDir, root ?? '')
  const config = loadConfig(searchDir)

  const functionsRoot = config.configDir
    ? path.resolve(config.configDir, config.root ?? '')
    : searchDir

  const functionFilter = getFunctionFilter(config)
  const adapter = config.adapter ?? 'node'

  const entries = await glob(functionFilter.globs, {
    cwd: functionsRoot,
    onlyFiles: true,
  })

  const entryPoints = Array.from(
    new Set(entries.map(entry => entry.split(path.sep).join('/')))
  )

  const routes = entryPoints
    .map(entry => {
      const name = entry.replace(functionFilter.suffixPattern, '')
      return {
        entry,
        name,
        path: '/' + name,
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))

  const seenPaths = new Set<string>()
  for (const route of routes) {
    if (seenPaths.has(route.path)) {
      throw new Error(`Duplicate route detected: ${route.path}`)
    }
    seenPaths.add(route.path)
  }

  const outputDir = path.resolve(workingDir, outdir ?? 'dist')
  fs.mkdirSync(outputDir, { recursive: true })

  const packageDir = findUpSync('dist', {
    cwd: import.meta.dirname,
    type: 'directory',
  })

  if (!packageDir) {
    throw new Error('Unable to locate the package dist directory.')
  }

  const source = path.join(packageDir, 'targets/build.js')
  const outfile = path.join(outputDir, 'index.js')

  const result = await esbuild.build({
    entryPoints: [source],
    absWorkingDir: functionsRoot,
    outfile,
    define,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    packages: 'bundle',
    sourcemap: true,
    sourcesContent: false,
    logOverride: {
      'empty-glob': 'silent',
    },
    external: ['@google-cloud/functions-framework'],
    plugins: [
      {
        name: 'crf-virtual-functions',
        setup(build) {
          const filter = new RegExp(
            `^${virtualModuleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
          )
          build.onResolve({ filter }, () => ({
            path: virtualModuleId,
            namespace: virtualModuleNamespace,
          }))
          build.onLoad(
            { filter: /.*/, namespace: virtualModuleNamespace },
            () => ({
              contents: createVirtualModule({
                routes,
                adapter,
              }),
              loader: 'js',
              resolveDir: functionsRoot,
            })
          )
        },
      },
    ],
  })

  console.log(
    `[esbuild] Bundled ${routes.length} function${
      routes.length === 1 ? '' : 's'
    } into ${outfile}`
  )

  return result
}

function createVirtualModule({
  routes,
  adapter,
}: {
  routes: RouteEntry[]
  adapter: string
}) {
  const imports = routes.map((route, index) => {
    const importPath = route.entry.startsWith('.')
      ? route.entry
      : `./${route.entry}`
    return `import * as route${index} from ${JSON.stringify(importPath)};`
  })

  const routeEntries = routes.map(
    (route, index) =>
      `  { name: ${JSON.stringify(route.name)}, path: ${JSON.stringify(
        route.path
      )}, module: route${index} },`
  )

  return [
    ...imports,
    `export const adapter = ${JSON.stringify(adapter)};`,
    'export const routes = [',
    ...routeEntries,
    '];',
    '',
  ].join('\n')
}
