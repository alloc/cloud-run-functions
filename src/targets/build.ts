import 'source-map-support/register.js'

import functions, {
  type Request,
  type Response,
} from '@google-cloud/functions-framework'
import { adapter, routes } from 'virtual:cloud-run-functions'

type Route = (typeof routes)[number]
type TaskHandler = (req: Request, res: Response) => unknown

const routesByPath = new Map(routes.map(route => [route.path, route]))
const handlerCache = new Map<string, TaskHandler>()

function unwrapHandler(module: Route['module']): TaskHandler | null {
  let handler: any = module
  while (handler && typeof handler !== 'function') {
    handler = handler.default
  }
  return typeof handler === 'function' ? handler : null
}

async function getHandler(route: Route): Promise<TaskHandler> {
  const cached = handlerCache.get(route.path)
  if (cached) {
    return cached
  }

  let handler: any = unwrapHandler(route.module)
  if (!handler) {
    throw new Error(`Task ${route.name} is not a function.`)
  }

  switch (adapter) {
    case 'hattip': {
      const { createMiddleware } = await import('@hattip/adapter-node')
      handler = createMiddleware(handler)
      break
    }
  }

  handlerCache.set(route.path, handler)
  return handler
}

async function match(url: URL): Promise<TaskHandler | null> {
  const route = routesByPath.get(url.pathname)
  if (!route) {
    return null
  }
  return getHandler(route)
}

functions.http('build', async (req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host)
  const handler = await match(url)

  if (handler) {
    try {
      await handler(req, res)
    } catch (error) {
      console.error(error)
      res.status(500).end()
    }
  } else {
    res.status(404).end()
  }
})
