import http from 'http'

type Request = http.IncomingMessage & {
  post: unknown
}

function processPost(request: Request, response: unknown, callback: unknown) {
  let queryData = ''
  if (typeof callback !== 'function')
    return null

  request.on('data', function (data) {
    queryData += data
  })

  request.on('end', function () {
    request.post = JSON.parse(queryData)
    callback()
  })
}

const sendResponse = (res: http.ServerResponse, statusCode: number, body: string) => {
  res.statusCode = statusCode
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.write(body)
  res.end()
}

const send200 = (res: http.ServerResponse, body?: string) => {
  sendResponse(res, 200, body || '{ status: "OK" }')
}

export default (port: number, mockData = {}): Promise<http.Server> => {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = req.url
      if (url === '/ok') {
        send200(res)
        return
      }

      if (url?.startsWith('/echo')) {
        const echo = url.slice(8)
        sendResponse(res, 200, JSON.stringify({ echo }))
        return
      }

      if (url?.startsWith('/number')) {
        const status = +url.slice(8, 11)
        sendResponse(res, status, JSON.stringify(mockData))
        return
      }

      if (url?.startsWith('/sleep')) {
        const wait = +(url?.split('/')?.pop() ?? '0')
        setTimeout(() => {
          send200(res)
        }, wait)
        return
      }

      if (url === '/post') {
        const request = req as Request
        processPost(request, res, function() {
          sendResponse(res, 200, JSON.stringify({ got: request.post }))
        })
      }
    })
    server.listen(port, 'localhost', () => resolve(server))
  })
}

export { Server } from 'http'