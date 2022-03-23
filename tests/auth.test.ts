import test from 'ava'
import { ApiConnector, idempotencyKeyFrom, to } from '../'
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
