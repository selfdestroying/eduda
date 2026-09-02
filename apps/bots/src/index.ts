import { createServer, type IncomingMessage } from 'node:http'
import { env } from './env'
import type { Reply, RouteRequest } from './route'
import { handleDispatch } from './routes/dispatch'
import { handleMax } from './routes/max'
import { handleVk } from './routes/vk'

/**
 * Приём вебхуков и крон-роут. Не Next: рендерить здесь нечего, а четвёртая
 * сборка Next на одноядерной машине стоит дороже, чем весь этот файл.
 *
 * Роутов мало, поэтому и роутер такой.
 *
 * ponytail: свой роутер на node:http — четыре роута. Hono (+2 зависимости),
 * когда их станет больше горстки или понадобится валидация тел.
 */

const routes: Record<string, (req: RouteRequest) => Promise<Reply>> = {
  'POST /vk': handleVk,
  'POST /max': handleMax,
  'GET /dispatch': handleDispatch,
  'GET /health': async () => ({ text: 'ok' }),
}

/** Вебхуки ботов — это килобайты; всё, что больше, читать незачем. */
const MAX_BODY = 1_000_000

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new Error('тело запроса слишком большое')
    chunks.push(chunk as Buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

const server = createServer((req, res) => {
  // База URL нужна только чтобы отделить путь от строки запроса — наружу этот
  // адрес не идёт.
  const url = new URL(req.url ?? '/', 'http://localhost')
  const route = `${req.method} ${url.pathname}`
  const handler = routes[route]

  const send = (reply: Reply) => {
    res.writeHead(reply.status ?? 200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(reply.text)
  }

  if (!handler) {
    send({ status: 404, text: 'not found' })
    return
  }

  const header = (name: string) => {
    const value = req.headers[name]
    return Array.isArray(value) ? value[0] : value
  }

  void readBody(req)
    .then((body) => handler({ body, url, header }))
    .then(send)
    .catch((error) => {
      // Ошибку глотать нельзя: и VK, и MAX на неудачный ответ просто перестают
      // слать события, каждый по-своему тихо.
      console.error(route, error)
      send({ status: 500, text: 'error' })
    })
})

server.listen(env.port, () => {
  console.log(`bots: слушаю :${env.port}`)
})
