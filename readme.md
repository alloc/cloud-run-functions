# cloud-run-functions

File-based routing plus local dev and bundling for `@google-cloud/functions-framework`.

You point it at a directory of `.ts` or `.js` files. \
Each file becomes an HTTP route and its default export is treated as the handler.

## Install

`@google-cloud/functions-framework` is required because this package runs it under the hood.

```sh
pnpm add -D cloud-run-functions @google-cloud/functions-framework
```

Optional:

```sh
pnpm add -D dotenv
pnpm add -D @hattip/adapter-node
```

## Quick start

Create a function file:

`functions/hello.ts`

```ts
export default (req, res) => {
  res.status(200).send('hello')
}
```

Run the dev server:

```sh
pnpx cloud-run-functions dev functions
```

Call it:

```sh
curl http://localhost:8080/hello
```

## Routing

- A file path becomes a URL path
- `functions/hello.ts` becomes `/hello`
- `functions/users/create.ts` becomes `/users/create`
- Your file should default export a function handler
- If you set `entrySuffix` to `.task`, then `hello.task.ts` becomes `/hello`

## CLI

The binary name is `cloud-run-functions`.

### dev

Start the development server with hot reload.

```sh
npx cloud-run-functions dev [root]
```

- `root` is the directory to search for function entrypoints. Default is the current working directory
- `--port, -p <port>` sets the port. Default is `8080`
- `--define, -d <key:value>` can be repeated. It passes `define` values to esbuild

### build

Bundle your functions for deployment.

```sh
npx cloud-run-functions build [root]
```

- `root` is the directory to search for function entrypoints. Default is the current working directory
- `--outdir, -o <dir>` sets the output directory. Default is `dist`
- `--define, -d <key:value>` can be repeated. It passes `define` values to esbuild

Output:

- Writes `index.js` and sourcemaps into `outdir`
- Run it with the Functions Framework using the `build` target

Example:

```sh
npx cloud-run-functions build functions
npx functions-framework --target=build --source dist/index.js
```

### preview

Preview bundled functions locally.

```sh
npx cloud-run-functions preview [--outDir <dir>]
```

- `--outDir, -o <dir>` sets the directory containing the bundled output. Default is `dist`

This runs the Functions Framework using the `build` target and your bundled `index.js`.

## Define values

The CLI format is `--define key:value` or `-d key:value`.

- If `value` looks like a number, it is used as one
- Otherwise it is treated as a string literal

Examples:

```sh
npx cloud-run-functions dev functions -d process.env.STAGE:dev
npx cloud-run-functions build functions -d __BUILD_ID__:123
```

If you need full control over esbuild `define` values, use the programmatic API.

## Configuration

Create a `crf.config.json` file. \
It is searched for by walking up from the `root` directory you pass to the CLI.

Example:

```json
{
  "root": "functions",
  "entrySuffix": ".task",
  "adapter": "node",
  "maxInstanceConcurrency": 5
}
```

Options:

- `root` string. base directory when searching for entry points. default is the config directory
- `globs` string array. globs to search within `root`. default is `["**/*"]`
- `extensions` string array. file extensions to match. default is `[".ts", ".js"]`
- `entrySuffix` string. require a suffix like `.task` before the extension
- `adapter` `"node"` or `"hattip"`. default is `"node"`
- `maxInstanceConcurrency` number or record of `{ [routeName]: number }`. default is `5`. used by `dev` to limit concurrent requests per route

Adapter notes:

- `adapter: "node"` means your default export should be a Functions Framework handler `(req, res) => ...`
- `adapter: "hattip"` means your default export should be a Hattip app and it will be wrapped at runtime

## Dotenv support

If `dotenv` is installed, `dev` will load the closest `.env` file under your functions root.
Values in `.env` do not override existing `process.env` values.

## Programmatic API

The package also exports the underlying functions used by the CLI:

```ts
import { build, dev, preview } from 'cloud-run-functions'
```

See `src/index.ts` for the current exports and `src/tools/*.ts` for option types.
