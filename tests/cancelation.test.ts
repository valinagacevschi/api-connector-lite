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
    cancelOldRequest: true,
  })
})

test.after.always('cleanup', () => {
  server?.close()
})

test('cancel old request', async (t) => {
  const instance = ApiConnector.getInstance()
  instance.get('/sleep/200').then((response) => {
    t.falsy(response)
  })
  await instance.get('/sleep/200').then((response) => {
    t.is(response.status, 200)
    t.deepEqual(response.data, { status: 'OK' })
  })
})

test('cancel no request', async (t) => {
  const instance = ApiConnector.getInstance('default', {
    baseURL: `http://localhost:${port}`,
  })
  instance.get('/sleep/200').then((response) => {
    t.is(response.status, 200)
    t.is(response.statusText, 'OK')
  })
  await instance.get('/sleep/200').then((response) => {
    t.is(response.status, 200)
    t.deepEqual(response.data, { status: 'OK' })
  })
})
