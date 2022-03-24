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
  await instance.get('/sleep/3001').catch((error) => {
    t.is(error.config.method, 'get')
    t.is(error.config.timeout, 3000)
    t.falsy(error.response)
    t.truthy(error.isAxiosError)
    t.is(error.message, 'timeout of 3000ms exceeded')
  })
})

test('no default timeout', async (t) => {
  const instance = ApiConnector.getInstance()
  await instance.get('/sleep/3001', { timeout: 0 }).then((response) => {
    t.is(response.config.method, 'get')
    t.is(response.config.timeout, 0)
  })
})
