import test from 'ava'
import { ApiConnector } from '../'
import newServer, { getFreePort, Server } from './_server'

let server: Server

test.before(async () => {
  const port = await getFreePort()
  server = await newServer(port)
  ApiConnector.getInstance('default', { baseURL: `http://localhost:${port}` })
})

test.after.always('cleanup', (t) => {
  server?.close()
})

test('GET supports params', async (t) => {
  const instance = ApiConnector.getInstance()
  const resp = await instance.get('/echo?a=1&b=2')
  t.is(resp.config.method, 'get')
  t.deepEqual(resp.data, {
    echo: 'a=1&b=2',
    params: {
      a: '1',
      b: '2',
    }
  })
})

test('POST supports params', async (t) => {
  const instance = ApiConnector.getInstance()
  const resp = await instance.post('/post', { a: 1, b: 2 })
  t.is(resp.config.method, 'post')
  t.deepEqual(resp.data, { a: 1, b: 2 })
})

test('PUT supports params', async (t) => {
  const instance = ApiConnector.getInstance()
  const resp = await instance.put('/post', { a: 11, b: 22 })
  t.is(resp.config.method, 'put')
  t.deepEqual(resp.data, { a: 11, b: 22 })
})

test('PATCH supports params', async (t) => {
  const instance = ApiConnector.getInstance()
  const resp = await instance.put('/post', { a: 111, b: 222 })
  t.is(resp.config.method, 'put')
  t.deepEqual(resp.data, { a: 111, b: 222 })
})
