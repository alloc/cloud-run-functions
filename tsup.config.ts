import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/main.ts', 'src/targets/*.ts', 'src/tools/*.ts'],
  format: ['esm'],
  dts: true,
  external: ['virtual:cloud-run-functions'],
})
