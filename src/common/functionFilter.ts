import path from 'node:path'

export function getFunctionFilter(options: {
  entrySuffix?: string
  globs?: string[]
  extensions?: string[]
}) {
  const functionGlobs: string[] = []
  const functionSuffixes = new Set<string>()

  const requiredSuffix = options.entrySuffix?.replace(/^\.?/, '.') ?? ''

  for (const glob of options.globs ?? ['**/*']) {
    let ext = path.extname(glob)
    if (ext) {
      functionSuffixes.add(requiredSuffix + ext)
      functionGlobs.push(
        requiredSuffix ? glob.replace(ext, requiredSuffix + ext) : glob
      )
      continue
    }
    for (ext of options.extensions ?? ['.ts', '.js']) {
      ext = requiredSuffix + ext
      functionSuffixes.add(ext)
      functionGlobs.push(glob + ext)
    }
  }

  const suffixPattern = new RegExp(
    `(${Array.from(functionSuffixes, e => e.replace(/\./g, '\\.'))
      .sort((a, b) => b.length - a.length)
      .join('|')})$`
  )

  return {
    globs: functionGlobs,
    suffixPattern,
  }
}
