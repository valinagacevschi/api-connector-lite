import test from 'ava'
import { ApiConnector, idempotencyKeyFrom } from '../'
import newServer, { getFreePort, Server } from './_server'

let server: Server

test.before(async () => {
  const port = await getFreePort()
  server = await newServer(port)
  ApiConnector.getInstance('default', {
    baseURL: `http://localhost:${port}`,
    apiKey: '1234-5678-9012-3456',
    headers: {
      Authorization: 'Bearer aaaa-bbbb-cccc-dddd',
    },
  })
  ApiConnector.getInstance('i1', {
    baseURL: `http://localhost:${port}`,
    apiKey: '5678-9012-3456-1234',
    headers: {
      Authorization: 'Bearer bbbb-cccc-dddd-eeee',
    },
  })
  ApiConnector.getInstance('i2', {
    baseURL: `http://localhost:${port}`,
    apiKey: '9012-3456-1234-5678',
    headers: {
      Authorization: 'Bearer cccc-dddd-eeee-ffff',
    },
  })
})

test.after.always('cleanup', () => {
  server?.close()
})

test('has set headers correctly', async (t) => {
  const i0 = ApiConnector.getInstance()
  t.deepEqual(i0.defaults.headers.common, {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-ApiKey': '1234-5678-9012-3456',
    'Authorization': 'Bearer aaaa-bbbb-cccc-dddd',
  })

  const i1 = ApiConnector.getInstance('i1')
  t.deepEqual(i1.defaults.headers.common, {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-ApiKey': '5678-9012-3456-1234',
    'Authorization': 'Bearer bbbb-cccc-dddd-eeee',
  })

  const i2 = ApiConnector.getInstance('i2')
  t.deepEqual(i2.defaults.headers.common, {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-ApiKey': '9012-3456-1234-5678',
    'Authorization': 'Bearer cccc-dddd-eeee-ffff',
  })
})

test('has set correctly accessToken and IdempotencyKey', async (t) => {
  const i0 = ApiConnector.getInstance()
  const p0 = { accessToken: '1', refreshToken: '2' }
  const r0 = await i0.post('/post', p0)
  t.is(r0.status, 200)
  t.is(r0.config.headers?.['Idempotency-Key'], idempotencyKeyFrom(p0, '/post'))
  t.is(i0.getApiHeaders().Authorization, 'Bearer 1')
  t.deepEqual(r0.data, p0)

  const i1 = ApiConnector.getInstance('i1')
  const p1 = { accessToken: '11', refreshToken: '22' }
  const r1 = await i1.post('/post', p1)
  t.is(r1.status, 200)
  t.is(r1.config.headers?.['Idempotency-Key'], idempotencyKeyFrom(p1, '/post'))
  t.is(i1.getApiHeaders().Authorization, 'Bearer 11')
  t.is(i0.getApiHeaders().Authorization, 'Bearer 1')
  t.deepEqual(r1.data, p1)

  const i2 = ApiConnector.getInstance('i2')
  const p2 = { accessToken: '111', refreshToken: '222' }
  const r2 = await i2.post('/post', p2)
  t.is(r2.status, 200)
  t.is(r2.config.headers?.['Idempotency-Key'], idempotencyKeyFrom(p2, '/post'))
  t.is(i2.getApiHeaders().Authorization, 'Bearer 111')
  t.is(i1.getApiHeaders().Authorization, 'Bearer 11')
  t.is(i0.getApiHeaders().Authorization, 'Bearer 1')
  t.deepEqual(r2.data, p2)
})
