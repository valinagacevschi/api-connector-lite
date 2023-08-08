import axios, {
  AxiosAdapter,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
  AxiosResponseHeaders,
} from 'axios'
import { ConfigMetaData, ConnectionConfig, FetchResult, ReactotronType } from '../types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const httpAdapter = require('axios/lib/adapters/http')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const settle = require('axios/lib/core/settle')

export function create(config: ConnectionConfig): AxiosInstance {
  const adapter: AxiosAdapter = (request) =>
    new Promise((resolve, reject) =>
      httpAdapter(request)
        .then(debugTron(request, config.tron))
        .then((response: FetchResult) => settle(resolve, reject, response)),
    )

  const instance = axios.create({ ...config, adapter })
  return instance
}

/**
 * Don't include the response bodies for images by default.
 */
const DEFAULT_CONTENT_TYPES_RX = /^(image)\/.*$/i
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

const tronifyResponse = (
  requestConfig: AxiosRequestConfig & ConfigMetaData,
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
  const duration = (requestConfig.metadata?.duration as number) ?? -1
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

  return [tronRequest, tronResponse, duration]
}

const debugTron =
  (config: AxiosRequestConfig, tron?: ReactotronType) =>
  (response: FetchResult): FetchResult => {
    try {
      const tronResponse = tronifyResponse(config, response)
      tron?.apiResponse?.(...tronResponse)
    } catch (e) {
      console.warn('Tron debug error', e)
    }
    return response
  }

export const tronLog = (name: string, tron?: ReactotronType) =>
  (value: unknown): void => tron?.display({ value, name, important: true })
