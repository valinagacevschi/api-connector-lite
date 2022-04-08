import test from 'ava'
import { ApiConnector } from '../'
import newServer, { getFreePort, Server } from './_server'

const HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'axios/0.26.1',
}
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

test('has valid data with a 200', async (t) => {
  const instance = ApiConnector.getInstance()
  const response = await instance.get('/number/200')
  t.is(response.status, 200)
  t.deepEqual(response.data, MOCK)
})

test('has valid error with a 400', async (t) => {
  const instance = ApiConnector.getInstance()
  await instance.get('/number/404').catch((error) => {
    t.is(error.response.status, 404)
    t.is(error.response.statusText, 'Not Found')
    t.is(error.response.config.url, '/number/404')
    t.deepEqual(error.response.config.headers, HEADERS)
    t.deepEqual(error.response.data, MOCK)
  })
})

test('has valid error with a 500', async (t) => {
  const instance = ApiConnector.getInstance()
  await instance.get('/number/500').catch((error) => {
    t.is(error.response.status, 500)
    t.is(error.response.statusText, 'Internal Server Error')
    t.is(error.response.config.url, '/number/500')
    t.deepEqual(error.response.config.headers, HEADERS)
    t.deepEqual(error.response.data, MOCK)
  })
})
