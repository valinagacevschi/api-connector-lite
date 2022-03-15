import Reactotron from 'reactotron-react-native'
import axios, { 
  AxiosAdapter, 
  AxiosInstance,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
  AxiosResponseHeaders,
 } from 'axios'
import { ConnectionConfig, FetchResult } from '../types'

const __DEV__ = true

const httpAdapter = require('axios/lib/adapters/http')
const settle = require('axios/lib/core/settle')

export function create(config: ConnectionConfig): AxiosInstance {
  const adapter: AxiosAdapter = (request) =>
    new Promise((resolve, reject) =>
      httpAdapter(request)
        .then(debugTron(request))
        .then((response: FetchResult) => settle(resolve, reject, response)),
    )

  const instance = axios.create({ ...config, adapter })
  return instance
}

const debugTron =
  (config: AxiosRequestConfig) =>
  (response: FetchResult): FetchResult => {
    if (__DEV__) {
      try {
        const tronResponse = tronifyResponse(config, response)
        Reactotron.apiResponse?.(...tronResponse)
      } catch (e) {
        console.warn('Tron debug error', e)
      }
    }
    return response
  }

/**
 * Don't include the response bodies for images by default.
 */
 const DEFAULT_CONTENT_TYPES_RX = /^(image)\/.*$/i

const tronifyResponse = (
  requestConfig: AxiosRequestConfig,
  response?: AxiosResponse,
): [TronRequestType, TronResponseType, number] => {
  const tronRequest = {
    url: `${requestConfig.baseURL}${requestConfig.url}` || 'UNSPECIFIED',
    method: requestConfig.method,
    data: requestConfig.data || null,
    headers: requestConfig.headers,
    params: requestConfig.params || null,
  }

  const { status, data: responseData, headers } = response || {}

  const responseHeaders = headers?.map as unknown as AxiosResponseHeaders
  const contentType =
    responseHeaders?.['Content-Type'] || responseHeaders?.['content-type']
  const useRealdata =
    typeof responseData === 'object' && !DEFAULT_CONTENT_TYPES_RX.test(contentType || '')
  const body = useRealdata ? responseData : JSON.parse(responseData) || '~~~ skipped ~~~'
  const tronResponse = {
    headers: responseHeaders,
    status,
    body,
  }

  return [tronRequest, tronResponse, 0]
}

type TronRequestType = {
  url: string
  method?: string
  data?: Record<string, never> | null
  headers?: AxiosRequestHeaders
  params?: Record<string, never> | null
}
type TronResponseType = {
  status?: number
  headers: AxiosRequestHeaders
  body?: Record<string, never>
}
