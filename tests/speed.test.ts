import test from 'ava'
import { ApiConnector } from '../'
import newServer, { getFreePort, Server } from './_server'

let server: Server
let port = 3000

test.before(async () => {
  port = await getFreePort()
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

test('zero duration for post, put, patch if turned off', async (t) => {
  const instance = ApiConnector.getInstance('default', { baseURL: `http://localhost:${port}` })
  const r1 = await instance.put('/sleep/100', { a: 111, b: 222 })
  const d1 = ((r1.config as MetaData)?.metadata?.duration ?? 0) as number
  t.is(d1, 0)
  t.is(r1.config.method, 'put')
  t.is(r1.status, 200)
  t.deepEqual(r1.data, { status: 'OK' })

  const r2 = await instance.put('/sleep/100', { a: 111, b: 222 })
  const d2 = ((r2.config as MetaData)?.metadata?.duration ?? 0) as number
  t.is(d2, 0)
  t.is(r2.config.method, 'put')
  t.is(r2.status, 200)
  t.deepEqual(r2.data, { status: 'OK' })

  const r3 = await instance.put('/sleep/100', { a: 111, b: 222 })
  const d3 = ((r3.config as MetaData)?.metadata?.duration ?? 0) as number
  t.is(d3, 0)
  t.is(r3.config.method, 'put')
  t.is(r3.status, 200)
  t.deepEqual(r3.data, { status: 'OK' })
})
