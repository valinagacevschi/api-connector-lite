import test from 'ava'
import { ApiConnector } from '../'

test.before(async () => {
  ApiConnector.getInstance('default', { baseURL: `http://localhost:32142` })
})

test('has a response despite no server', async (t) => {
  const instance = ApiConnector.getInstance()
  await instance.get('/number/200').then(r => r).catch(({
    code, isAxiosError, message, response
  }) => {
    t.is(code, 'ECONNREFUSED')
    t.truthy(isAxiosError)
    t.is(message, `connect ECONNREFUSED 127.0.0.1:32142`)
    t.falsy(response)
  })
})