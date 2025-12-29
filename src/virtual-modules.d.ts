declare module 'virtual:cloud-run-functions' {
  export type BundledRoute = {
    name: string
    path: string
    module: unknown
  }

  export const adapter: 'hattip' | 'node'
  export const routes: BundledRoute[]
}
