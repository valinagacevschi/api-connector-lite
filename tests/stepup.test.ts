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
    stepUpAuthEnabled: true,
  })
})

test.after.always('cleanup', () => {
  server?.close()
})

test('has set correctly TransactionId with u&p', async (t) => {
  const instance = ApiConnector.getInstance()
  await instance.post('/post/403', { a: 1, transactionId: 1234 }).catch(async (error) => {
    t.is(error.response.status, 403)
    // the 403 response error with transactionId in payload popupated the headers
    t.is(error.config.headers?.['X-TransactionId'], '1234')
    await instance.stepUp('username', 'passcode').catch((error) => {
      t.deepEqual(error.response.data, { a: 1, transactionId: 1234 })
    })
  })
})

test('has set correctly TransactionId with refreshToken', async (t) => {
  const instance = ApiConnector.getInstance()
  await instance.get('/sleep/100')
  await instance.post('/post/403', {
    text: 1,
    transactionId: 1234,
    accessToken: 'aa',
    refreshToken: 'bb',
  }).catch(async (error) => {
    t.is(error.response.status, 403)
    // the 403 response error with transactionId in payload popupated the headers
    t.is(error.config.headers?.['X-TransactionId'], '1234')
    await instance.stepUp().catch((error) => {
      t.deepEqual(error.response.data, {
        text: 1,
        transactionId: 1234,
        accessToken: 'aa',
        refreshToken: 'bb',
      })
    })
  })
})

test('has no TransactionId if stepup disabled', async (t) => {
  const instance = ApiConnector.getInstance('default', { baseURL: `http://localhost:${port}` })
  await instance.get('/sleep/100')
  await instance.post('/post/403', {
    text: 1,
    transactionId: 1234,
    accessToken: 'aa',
    refreshToken: 'bb',
  }).catch(async (error) => {
    t.is(error.response.status, 403)
    t.is(error.config.headers?.['X-TransactionId'], undefined)
    await instance.stepUp().catch((error) => {
      t.is(error, undefined)
    })
  })
})