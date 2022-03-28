import test from 'ava'
import { ApiConnector } from '../'
import newServer, { getFreePort, Server } from './_server'

let server: Server

test.before(async () => {
  const port = await getFreePort()
  server = await newServer(port)
  ApiConnector.getInstance('default', { baseURL: `http://localhost:${port}` })
})

test.after.always('cleanup', () => {
  server?.close()
})

test('timeout 3sec', async (t) => {
  const instance = ApiConnector.getInstance()
  await instance.get('/sleep/3001').then((response) => {
    t.is(response.statusText, 'OK')
    t.is(response.status, 200)
    t.is(response.config.url, '/sleep/3001')
    t.is(response.config.timeout, 3000 * 5)
  })
})

test('no default timeout', async (t) => {
  const instance = ApiConnector.getInstance()
  await instance.get('/sleep/3001', { timeout: 0 }).then((response) => {
    t.is(response.config.method, 'get')
    t.is(response.config.timeout, 0)
  })
})
