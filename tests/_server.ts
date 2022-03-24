import http from 'http'
import net from 'net'

type Request = http.IncomingMessage & {
  post: Record<string, unknown>
}

export default (port: number, mockData = {}): Promise<http.Server> => {
  return new Promise(resolve => {
    const server = http.createServer((req, response) => {
      const url = req.url
      if (url === '/ok') {
        send200(response)
        return
      }

      if (url?.startsWith('/echo')) {
        const echo = url.slice(6)
        const params = url.includes('?') ? Object.fromEntries(new URLSearchParams(echo)) : undefined
        sendResponse(response, 200, JSON.stringify({ echo, params }))
        return
      }

      if (url?.startsWith('/number')) {
        const status = +url.slice(8)
        sendResponse(response, status, JSON.stringify(mockData))
        return
      }

      if (url?.startsWith('/sleep')) {
        const wait = +(url?.split('/')?.pop() ?? '0')
        setTimeout(() => {
          send200(response)
        }, wait)
        return
      }

      if (url?.startsWith('/post')) {
        const status = +(url?.split('/')?.pop() ?? '200') || 200
        const request = req as Request
        processPost(request, response, function() {
          sendResponse(response, status, JSON.stringify(request.post))
        })
      }

      if (url?.startsWith('/v1/oauth2/refresh')) {
        const request = req as Request
        processPost(request, response, function() {
          const refreshToken  = request.post.refreshToken as string
          const tokens = {
            accessToken: refreshToken,
            refreshToken: refreshToken.split('').reverse().join()
          }
          sendResponse(response, 200, JSON.stringify(tokens))
        })
      }

      if (url?.startsWith('/v1/oauth2/stepup')) {
        const request = req as Request
        processPost(request, response, function() {
          const username  = request.post.username as string
          const passcode  = request.post.passcode as string
          const refreshToken  = request.post.refreshToken as string
          const authenticationMethod = request.post.authenticationMethod as string
          const newResponse = {
            username,
            passcode,
            refreshToken,
            authenticationMethod,
          }
          sendResponse(response, 200, JSON.stringify(newResponse))
        })
      }
    })
    server.listen(port, 'localhost', () => resolve(server))
  })
}


type AddressInfo = {
  address: string
  family: string
  port: number
}

export { Server } from 'http'
export const getFreePort = (): Promise<number> => new Promise(resolve => {
  const server = net.createServer()
  server.listen(() => {
    const { port } = server.address() as AddressInfo
    server.close(() => resolve(port))
  })
})

function processPost(request: Request, response: http.ServerResponse, callback?: Function) {
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
  sendResponse(res, 200, body || '{ "status": "OK" }')
}
