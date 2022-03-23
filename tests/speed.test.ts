import test from 'ava'
import { ApiConnector } from '../'
import newServer, { getFreePort, Server } from './_server'

let server: Server

test.before(async () => {
  const port = await getFreePort()
  server = await newServer(port)
  ApiConnector.getInstance('default', {
    baseURL: `http://localhost:${port}`,
    useResponseTime: true,
  })
})

test.after.always('cleanup', (t) => {
  server?.close()
})

type MetaData = { metadata: Record<string, unknown> }

test('GET speed test slower than 150', async (t) => {
  const instance = ApiConnector.getInstance()
  const resp = await instance.get('/sleep/150')
  const duration = ((resp.config as MetaData)?.metadata?.duration ?? 0) as number
  t.truthy(duration >= 150)
  t.is(resp.config.method, 'get')
  t.is(resp.status, 200)
})

test('POST speed test slower than 200', async (t) => {
  const instance = ApiConnector.getInstance()
  const resp = await instance.post('/sleep/200', { a: 1, b: 2 })
  const duration = ((resp.config as MetaData)?.metadata?.duration ?? 0) as number
  t.truthy(duration >= 200)
  t.is(resp.config.method, 'post')
  t.is(resp.status, 200)
  t.deepEqual(resp.data, { status: 'OK' })
})

test('PUT speed test slower than 250', async (t) => {
  const instance = ApiConnector.getInstance()
  const resp = await instance.put('/sleep/250', { a: 11, b: 22 })
  const duration = ((resp.config as MetaData)?.metadata?.duration ?? 0) as number
  t.truthy(duration >= 250)
  t.is(resp.config.method, 'put')
  t.is(resp.status, 200)
  t.deepEqual(resp.data, { status: 'OK' })
})

test('PATCH speed test slower than 300', async (t) => {
  const instance = ApiConnector.getInstance()
  const resp = await instance.put('/sleep/300', { a: 111, b: 222 })
  const duration = ((resp.config as MetaData)?.metadata?.duration ?? 0) as number
  t.truthy(duration >= 300)
  t.is(resp.config.method, 'put')
  t.is(resp.status, 200)
  t.deepEqual(resp.data, { status: 'OK' })
})
