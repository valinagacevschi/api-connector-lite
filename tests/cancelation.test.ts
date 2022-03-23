import test from 'ava'
import { ApiConnector } from '../'
import newServer, { getFreePort, Server } from './_server'

const MOCK = { a: { b: [1, 2, 3] } }
let server: Server

test.before(async () => {
  const port = await getFreePort()
  server = await newServer(port, MOCK)
  ApiConnector.getInstance('default', { 
    baseURL: `http://localhost:${port}`,
    cancelOldRequest: true,
  })
})

test.after.always('cleanup', (t) => {
  server?.close()
})

test('cancel old request', async t => {
  const instance = ApiConnector.getInstance()
  instance.get('/sleep/200').then(response => {
    t.falsy(response)
  })
  await instance.get('/sleep/200').then(response => {
    t.is(response.status, 200)
    t.deepEqual(response.data, { status: "OK" })
  })
})
