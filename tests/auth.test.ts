import test from 'ava'
import { ApiConnector, idempotencyKeyFrom } from '../'
import newServer, { getFreePort, Server } from './_server'

let server: Server
let port = 3000

test.before(async () => {
  port = await getFreePort()
  server = await newServer(port)
  ApiConnector.getInstance('default', { baseURL: `http://localhost:${port}` })
})

test.after.always('cleanup', () => {
  server?.close()
})

test('has set correctly accessToken', async (t) => {
  const instance = ApiConnector.getInstance()
  const payload = {
    accessToken: '1234567890',
    refreshToken: '9876543210',
  }
  const response = await instance.post('/post', payload)
  t.is(response.status, 200)
  const result = idempotencyKeyFrom(payload, '/post')
  t.is(response.config.headers?.['Idempotency-Key'], result)
  const { Authorization } = instance.getApiHeaders()
  t.is(Authorization, `Bearer ${payload.accessToken}`)
  t.deepEqual(response.data, payload)
})

test('has new tokens when 401', async (t) => {
  const instance = ApiConnector.getInstance()
  const payload = {
    accessToken: '1234567890',
    refreshToken: 'aaa-bbb-ccc-ddd',
  }
  const response = await instance.post('/post', payload)
  t.is(response.status, 200)
  const { Authorization } = instance.getApiHeaders()
  t.is(Authorization, `Bearer ${payload.accessToken}`)

  await instance.post('/post/401', { v: 1 }).catch((error) => {
    t.deepEqual(error, { v: 1 })
    const { Authorization } = instance.getApiHeaders()
    t.is(Authorization, `Bearer ${payload.refreshToken}`)
  })
})

test('has no access token when disabled', async (t) => {
  const instance = ApiConnector.getInstance('noauth', {
    baseURL: `http://localhost:${port}`,
    autoRefreshToken: false,
  })
  const payload = {
    accessToken: '1234567890',
    refreshToken: 'aaa-bbb-ccc-ddd',
  }
  const response = await instance.post('/post', payload)
  t.is(response.status, 200)
  const { Authorization } = instance.getApiHeaders()
  t.falsy(Authorization)
  await instance.post('/post/401', { v: 1 }).catch((error) => {
    t.is(error.response.status, 401)
    t.deepEqual(error.response.data, { v: 1 })
    const { Authorization } = instance.getApiHeaders()
    t.falsy(Authorization)
  })
})
