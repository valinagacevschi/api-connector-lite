import test from 'ava'
import { ApiConnector } from '../'
import newServer, { getFreePort, Server } from './_server'

let server: Server

test.before(async () => {
  const port = await getFreePort()
  server = await newServer(port)
  ApiConnector.getInstance('default', { baseURL: `http://localhost:${port}` })
})

test.after('cleanup', () => {
  server.close()
})

test('test adding headers', async (t) => {
  const instance = ApiConnector.getInstance()
  instance.updateHeaders({ 'X-DeviceKey': '1111-2222-3333-4444' })
  const { config } = await instance.get('/number/200')
  t.is(config.timeout, 3000)
  t.is(config.headers?.['X-DeviceKey'], '1111-2222-3333-4444')
})

test('test updating headers', async (t) => {
  const instance = ApiConnector.getInstance()
  // then change one of them
  instance.updateHeaders({ 'X-DeviceKey': '5555-2222-3333-4444' })
  const { config } = await instance.get('/number/200')
  t.is(config.headers?.['X-DeviceKey'], '5555-2222-3333-4444')
})

test('test deleting headers', async (t) => {
  const instance = ApiConnector.getInstance()
  // then remove one of them
  instance.updateHeaders({ 'X-DeviceKey': undefined })
  const { config } = await instance.get('/number/200')
  t.is(config.headers?.['X-DeviceKey'], undefined)
})
