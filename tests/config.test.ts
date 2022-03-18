import test from 'ava'
import { ApiConnector } from '../index'

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const validConfig = {
  baseURL: 'http://localhost:9991',
  headers: { 
    'X-DeviceKey': '1111-2222-3333-4444-5555'
  }
}

ApiConnector.getInstance('default', validConfig)

test('is a function', t => {
  t.is(typeof ApiConnector.getInstance, 'function')
})

test('returns an object when we configure correctly', t => {
  const x = ApiConnector.getInstance()
  t.truthy(x)
  t.is(typeof x.getApiHeaders, 'function')
})

test('configures axios correctly', t => {
  const axiosInstance = ApiConnector.getInstance()
  t.is(axiosInstance.defaults.timeout, 3000)
  t.is(axiosInstance.defaults.baseURL, validConfig.baseURL)
  t.deepEqual(axiosInstance.defaults.headers.common, {
    ...DEFAULT_HEADERS,
    ...validConfig.headers
  })
})
