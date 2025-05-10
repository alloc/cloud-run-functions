import * as z from '@zod/mini'
import Joycon from 'joycon'
import path from 'node:path'
import { configSchema } from './schema'

const joycon = new Joycon()

export type Config = z.infer<typeof configSchema> & {
  configDir: string | null
}

export function loadConfig(cwd: string): Config {
  const result = joycon.loadSync(['crf.config.json'], cwd)
  if (!result.path) {
    return {
      configDir: null,
    }
  }
  return {
    ...z.parse(configSchema, result.data),
    configDir: path.dirname(result.path),
  }
}
