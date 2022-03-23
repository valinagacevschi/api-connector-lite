import test from 'ava'
import { ApiConnector } from '../'
import newServer, { getFreePort, Server } from './_server'

const MOCK = { a: { b: [1, 2, 3] } }
let server: Server

test.before(async () => {
  const port = await getFreePort()
  server = await newServer(port, MOCK)
  ApiConnector.getInstance('default', { baseURL: `http://localhost:${port}` })
})

test.after.always('cleanup', (t) => {
  server?.close()
})

test('timeout 3sec', async (t) => {
  const instance = ApiConnector.getInstance()
  await instance.get('/sleep/3001').catch(error => {
    t.is(error.config.method, 'get')
    t.is(error.config.timeout, 3000)
    t.falsy(error.response)
    t.truthy(error.isAxiosError)
    t.is(error.message, 'timeout of 3000ms exceeded')
  })
})