import test from 'ava'
import { ApiConnector, idempotencyKeyFrom } from '../'
import newServer, { getFreePort, Server } from './_server'

const MOCK = { a: { b: [1, 2, 3] } }
let server: Server
let port = 3000

test.before(async () => {
  port = await getFreePort()
  server = await newServer(port, MOCK)
  ApiConnector.getInstance('default', { baseURL: `http://localhost:${port}` })
})

test.after.always('cleanup', () => {
  server?.close()
})

test('has valid idempotency for post with a 200', async (t) => {
  const instance = ApiConnector.getInstance()
  const response = await instance.post('/number/200', MOCK)
  t.is(response.status, 200)
  const result = idempotencyKeyFrom(MOCK, '/number/200')
  t.is(response.config.headers?.['Idempotency-Key'], result)
  t.deepEqual(response.data, MOCK)
})

test('has valid idempotency for put with a 200', async (t) => {
  const instance = ApiConnector.getInstance()
  const response = await instance.put('/number/200', MOCK)
  t.is(response.status, 200)
  const result = idempotencyKeyFrom(MOCK, '/number/200')
  t.is(response.config.headers?.['Idempotency-Key'], result)
  t.deepEqual(response.data, MOCK)
})

test('has valid idempotency for patch with a 200', async (t) => {
  const instance = ApiConnector.getInstance()
  const response = await instance.patch('/number/200', MOCK)
  t.is(response.status, 200)
  const result = idempotencyKeyFrom(MOCK, '/number/200')
  t.is(response.config.headers?.['Idempotency-Key'], result)
  t.deepEqual(response.data, MOCK)
})

test('has no idempotency for get with a 200', async (t) => {
  const instance = ApiConnector.getInstance()
  const response = await instance.get('/number/200')
  t.is(response.status, 200)
  t.is(response.config.headers?.['Idempotency-Key'], undefined)
  t.deepEqual(response.data, MOCK)
})

test('has idempotency disabled for put post and patch', async (t) => {
  const instance = ApiConnector.getInstance('default', {
    baseURL: `http://localhost:${port}`,
    useIdempotency: false,
  })

  const r1 = await instance.post('/number/200')
  t.is(r1.status, 200)
  t.is(r1.config.headers?.['Idempotency-Key'], undefined)
  t.deepEqual(r1.data, MOCK)

  const r2 = await instance.put('/number/200')
  t.is(r2.status, 200)
  t.is(r2.config.headers?.['Idempotency-Key'], undefined)
  t.deepEqual(r2.data, MOCK)

  const r3 = await instance.patch('/number/200')
  t.is(r3.status, 200)
  t.is(r3.config.headers?.['Idempotency-Key'], undefined)
  t.deepEqual(r3.data, MOCK)
})
