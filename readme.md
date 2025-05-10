# cloud-run-functions

> ⚠️ This project is not ready for production use.

Enhances the `@google-cloud/functions-framework` package with "hot reloading" (for local development) and a bundler (for deployment).

```
pnpm add cloud-run-functions -D
```

## Development server

The dev server uses the `@google-cloud/functions-framework` package to run your functions locally. We handle _transpiling_ and _hot reloading_ for you. Just tell the dev server where to find your functions.

```sh
npx cloud-run-functions dev ./path/to/functions/
```

By default, any `.ts` or `.js` module is considered "loadable" by the dev server. This behavior is configurable with a `crf.config.json` file.

The dev server uses filesystem routing. By default, the dev server runs on port 8080. So if you do `http get :8080/hello` from your terminal, the dev server will look for a file called `hello.ts` or `hello.js` in the `./path/to/functions/` directory. If that file exists, its default export will be used as the function handler.

## Bundling

When you're ready to deploy, use the `build` command to bundle your functions.

```sh
npx cloud-run-functions build ./path/to/functions/
```
