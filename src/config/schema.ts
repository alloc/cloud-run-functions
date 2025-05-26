import * as z from '@zod/mini'
import { dedent } from 'radashi'

export const configSchema = z.partial(
  z.interface({
    root: z.string().register(z.globalRegistry, {
      description: dedent`
        The base directory when searching for entry points.

        Defaults to the config directory (or if no config file is found, the current working directory).
      `,
    }),
    globs: z.array(z.string()).register(z.globalRegistry, {
      description: dedent`
        The globs determine which directories are searched for entry points. Only ".ts" and ".js" files are matched, so you're not required to include them in the globs.

        By default all directories in the "root" are searched.
      `,
    }),
    extensions: z.array(z.string()).register(z.globalRegistry, {
      description: dedent`
        The extensions to match for entry points.

        @default [".ts", ".js"]
      `,
    }),
    entrySuffix: z.string().register(z.globalRegistry, {
      description: dedent`
        The entry suffix should be a string like ".task" or ".function" which must be present in the file name (before the extension) or else that file will be ignored when scanning for entry points.

        It can also be an empty string.
      `,
    }),
    adapter: z.enum(['hattip', 'node']).register(z.globalRegistry, {
      description: dedent`
        The adapter wraps your Cloud Run functions at runtime, allowing you to write them with a platform-agnostic HTTP framework, like Hattip.

        Set this to "node" to skip using an adapter, in which case, your functions should conform to what @google-cloud/functions-framework expects.

        @default "node"
      `,
    }),
    maxInstanceConcurrency: z
      .union([z.number(), z.record(z.string(), z.number())])
      .register(z.globalRegistry, {
        description: dedent`
          The maximum number of instances (per function) that can be run concurrently. You can either set the same limit for all functions or set a different limit for each function.

          @default 5
        `,
      }),
  })
)
