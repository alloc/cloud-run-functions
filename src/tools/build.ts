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
