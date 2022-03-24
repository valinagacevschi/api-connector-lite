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

test.after.always('cleanup', () => {
  server?.close()
})

test('get can be used with async/await', async (t) => {
  const response = await ApiConnector.getInstance().get('/number/200')
  t.is(response.status, 200)
  t.deepEqual(response.data, MOCK)
})

test('post, put, patch can be used with async/await', async (t) => {
  const instance = ApiConnector.getInstance()
  const response = await instance.post('/post/200', { x: 1, y: 2 })
  t.is(response.request.method, 'POST')
  t.is(response.status, 200)
  t.deepEqual(response.data, { x: 1, y: 2 })

  const response1 = await instance.put('/post/200', { x: 10, y: 20 })
  t.is(response1.request.method, 'PUT')
  t.is(response1.status, 200)
  t.deepEqual(response1.data, { x: 10, y: 20 })

  const response2 = await instance.patch('/post/200', { x: 100, y: 200 })
  t.is(response2.request.method, 'PATCH')
  t.is(response2.status, 200)
  t.deepEqual(response2.data, { x: 100, y: 200 })
})
