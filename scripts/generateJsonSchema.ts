import * as z from '@zod/mini'
import fs from 'node:fs'
import { configSchema } from '../src/config/schema.ts'

fs.writeFileSync(
  'config.schema.json',
  JSON.stringify(z.toJSONSchema(configSchema), null, 2)
)
