import test from 'ava'
import { ApiConnector, to } from '../'
import newServer, { Server } from './_server'

const HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'axios/0.26.0',
}
const MOCK = { a: { b: [1, 2, 3] } }
let port = 8700
let server: Server

test.before(async () => {
  server = await newServer(port, MOCK)
  ApiConnector.getInstance('default', { 
    baseURL: `http://localhost:8700`,
  })
})

test.after.always('cleanup', (t) => {
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
