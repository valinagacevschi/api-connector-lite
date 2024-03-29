import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
} from 'axios'
import { Mutex } from 'async-mutex'
import * as debugWebAxios from './adapters/debugWebAxios'
import {
  AsyncResponse,
  AxiosErrorWithRetriableRequestConfig,
  ConfigMetaData,
  ConnectionConfig,
  ErrorResponse,
  ExtendedAxiosInstance,
  RefreshTokenResponse,
  StepUpPayload,
} from './types'

const ACCESS_TOKEN_EXPIRED = 401
const REFRESH_PATH = '/oauth2/refresh'
const STEP_UP_REQUIRED = 403
const STEPUP_PATH = '/oauth2/stepup'

const DEFAULT_CONFIG = { timeout: 3000 }
const DEFAULT_HEADERS: AxiosRequestHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}
const ApiConnector = (() => {
  const instances: Record<string, ExtendedAxiosInstance> = {}

  function createInstance(name: string, config: ConnectionConfig): ExtendedAxiosInstance {
    const {
      refreshPath = REFRESH_PATH,
      stepupPath = STEPUP_PATH,
      autoRefreshToken = true,
      useIdempotency = false,
      cancelOldRequest,
      stepUpAuthEnabled = false,
      retryOnTimeout = false,
      useResponseTime = false,
      useEtag = false,
      tron,
      headers: inputHeaders,
      tokensPersist,
      tokenRehydrate,
      ...axiosConfig
    } = config

    const { apiKey } = axiosConfig

    const headers: AxiosRequestHeaders = {
      ...DEFAULT_HEADERS,
      // Add X-ApiKey header if it exists
      ...(apiKey ? { 'X-ApiKey': apiKey } : undefined),
      // Add any custom headers
      ...inputHeaders,
    }

    const currentExecutingRequests: Record<string, { cancel: () => void }> = {}
    const tokens: RefreshTokenResponse = {
      accessToken: undefined,
      refreshToken: undefined,
    }

    tokenRehydrate?.().then(
      ({ accessToken, refreshToken } = { accessToken: undefined, refreshToken: undefined }) => {
        tokens.accessToken = accessToken ?? tokens.accessToken
        tokens.refreshToken = refreshToken ?? tokens.refreshToken
      });

    const stepUpPayload: StepUpPayload = {}

    /**
     * Create mutex for refreshToken
     */
    const mutex = new Mutex()

    /**
     * Create main instance. Can be an axios instance or a debugWebAxios instance
     */
    const factory = global.window?.location ? debugWebAxios : axios
    const instance = factory.create({
      ...DEFAULT_CONFIG,
      ...axiosConfig,
    }) as ExtendedAxiosInstance

    /**
     * Add Headers
     */
    instance.defaults.headers.common = headers

    /**
     * Add Request Interceptors
     */
    instance.interceptors.request.use(authenticationInterceptor, undefined, {
      synchronous: true,
      runWhen: () => autoRefreshToken && !!tokens?.accessToken,
    })
    instance.interceptors.request.use(idempotencyInterceptor, undefined, {
      synchronous: true,
      runWhen: ({ method }: AxiosRequestConfig) =>
        useIdempotency && ['post', 'put', 'patch'].includes(method ?? ''),
    })
    instance.interceptors.request.use(cancelRequestInterceptor, undefined, {
      synchronous: true,
      runWhen: () => cancelOldRequest !== undefined,
    })
    instance.interceptors.request.use(
      (config: AxiosRequestConfig & ConfigMetaData) => {
        config.metadata = { ...config.metadata, startTime: +new Date() }
        return config
      },
      undefined,
      {
        synchronous: true,
        runWhen: () => useResponseTime,
      },
    )

    /**
     * Add Response Interceptors
     */
    instance.interceptors.response.use(
      cancelResponseInterceptor,
      cancelErrorInterceptor,
      {
        runWhen: () => cancelOldRequest !== undefined,
      },
    )
    instance.interceptors.response.use(storeTokensInterceptor, refreshTokenInterceptor, {
      runWhen: () => autoRefreshToken,
    })
    instance.interceptors.response.use(undefined, stepUpAuthInterceptor, {
      runWhen: () => stepUpAuthEnabled,
    })
    instance.interceptors.response.use(undefined, timeOutInterceptor, {
      runWhen: () => retryOnTimeout,
    })
    instance.interceptors.response.use(
      (response) => {
        if (useResponseTime) {
          updateResponseTime(response.config as ConfigMetaData)
        }
        return response
      },
      (error) => {
        if (useResponseTime) {
          updateResponseTime(error.config)
        }
        return Promise.reject(error)
      },
      {
        runWhen: () => useResponseTime,
      },
    )

    /**
     * Private interceptor
     * Add Authorization header if accessToken was previously set by
     * storeTokensInterceptor
     */
    function authenticationInterceptor(
      requestConfig: AxiosRequestConfig,
    ): AxiosRequestConfig {
      if (autoRefreshToken && requestConfig.headers) {
        requestConfig.headers['Authorization'] = `Bearer ${tokens.accessToken}`
      }
      return requestConfig
    }

    /**
     * Private interceptor
     * Add Idempotency-Key to POST, PUT and PATCH methods
     */
    function idempotencyInterceptor(
      requestConfig: AxiosRequestConfig,
    ): AxiosRequestConfig {
      if (requestConfig.headers) {
        const { data, url } = requestConfig
        requestConfig.headers['Idempotency-Key'] = idempotencyKeyFrom(data, url)
      }
      return requestConfig
    }

    /**
     * Private interceptor
     * Add cancelToken to request config to be able to cancel repeated
     * requests. If the url was already used and the cancelOldRequest flag is true,
     * the old request will be canceled and the new request will be performed, or
     * the new request will be canceled and the old will be preserved.
     */
    function cancelRequestInterceptor(
      requestConfig: AxiosRequestConfig,
    ): AxiosRequestConfig {
      const key = requestConfig?.url ?? ''
      if (currentExecutingRequests[key]) {
        const source = cancelOldRequest
          ? currentExecutingRequests[key]
          : axios.CancelToken.source()
        delete currentExecutingRequests[cancelOldRequest ? key : '']
        source.cancel()
      }

      const source = axios.CancelToken.source()
      currentExecutingRequests[key] = source
      return {
        ...requestConfig,
        cancelToken: source.token,
      }
    }

    /**
     * Private interceptor
     * Inspect every response and remove pending requests from
     * currentExecutingRequests object.
     * @param response: AxiosResponse<RefreshTokenResponse>
     */
    function cancelResponseInterceptor(
      response: AxiosResponse<RefreshTokenResponse>,
    ): AxiosResponse<RefreshTokenResponse> {
      if (cancelOldRequest !== undefined) {
        delete currentExecutingRequests[response.request?.responseURL]
      }
      return response
    }

    /**
     * Private interceptor
     * If the request failed because it was canceled, the error will
     * be silently discarded. On any other error, it will remove pending
     * requests from currentExecutingRequests object.
     * @param error: AxiosErrorWithRetriableRequestConfig
     */
    function cancelErrorInterceptor(error: AxiosErrorWithRetriableRequestConfig) {
      if (cancelOldRequest !== undefined) {
        if (axios.isCancel(error)) {
          return Promise.resolve()
        }
        const {
          config: { url = '' },
        } = error

        if (currentExecutingRequests[url]) {
          delete currentExecutingRequests[url]
        }
      }
      return Promise.reject(error)
    }

    /**
     * Private interceptor
     * Inspect every response for the accessToken, refreshToken pair
     * and store them if found
     * @param response: AxiosResponse<RefreshTokenResponse>
     */
    function storeTokensInterceptor(
      response: AxiosResponse<RefreshTokenResponse>,
    ): AxiosResponse<RefreshTokenResponse> {
      if (autoRefreshToken) {
        const { accessToken, refreshToken } = response?.data ?? {}

        tokens.accessToken = accessToken ?? tokens.accessToken
        tokens.refreshToken = refreshToken ?? tokens.refreshToken

        if (accessToken && refreshToken) {
          tokensPersist?.(tokens)
        }
      }
      return response
    }

    /**
     * Private interceptor
     * If request failed with timeout or 504 timeout.
     * @param error: AxiosErrorWithRetriableRequestConfig
     */
    function timeOutInterceptor(error: AxiosErrorWithRetriableRequestConfig) {
      if (retryOnTimeout) {
        const { config, response, code, message } = error
        const { status } = response ?? {}
        if ((code === 'ECONNABORTED' && message.match(/timeout/)) || status === 504) {
          const { timeout, ...request } = config
          if ((timeout ?? 1e10) > 6e4) {
            return Promise.reject(error)
          }
          return instance.request({ ...request, timeout: (timeout ?? 1e3) * 5 })
        }
      }
      return Promise.reject(error)
    }

    /**
     * Private interceptor
     * If request failed with status 401 accessToken expiration, refresh tokens.
     * @param error: AxiosErrorWithRetriableRequestConfig
     */
    function refreshTokenInterceptor(error: AxiosErrorWithRetriableRequestConfig) {
      const { response: { status, data = {} } = {}, config } = error

      if (autoRefreshToken && status === ACCESS_TOKEN_EXPIRED) {
        if (config.metadata?.didRetry) {
          return Promise.reject(data)
        }
        config.metadata = { ...config.metadata, didRetry: true }
        return refreshToken().then(() => instance.request(config))
      }
      return Promise.reject(error)
    }

    /**
     * Private interceptor
     * If request failed with status 403 stepup required.
     * @param error: AxiosErrorWithRetriableRequestConfig
     */
    function stepUpAuthInterceptor(error: AxiosErrorWithRetriableRequestConfig) {
      if (stepUpAuthEnabled) {
        const { response, config } = error
        const { status, data } = response || {}
        const { transactionId, authenticationMethods } =( data || {}) as StepUpPayload

        if (status === STEP_UP_REQUIRED && transactionId) {
          config.headers ??= {}
          config.headers['X-TransactionId'] = `${transactionId}`
          stepUpPayload.transactionId = transactionId
          stepUpPayload.authenticationMethods = authenticationMethods
          stepUpPayload.config = config
        }
      }
      return Promise.reject(error)
    }

    /**
     * Create a separate axions instance for auth refresh token
     */
    const refreshInstance: AxiosInstance = factory.create({
      ...DEFAULT_CONFIG,
      ...axiosConfig,
      tron,
      headers,
    })

    /**
     * The refreshToken handler will be accessible from the instance
     * to be called when we need to force an Auth Token refresh.
     * It use mutex to prevent multiple refresh requests.
     */
    async function refreshToken(): Promise<void> {
      const { refreshToken } = tokens
      return mutex.runExclusive(() => refreshInstance
        .post<RefreshTokenResponse>(refreshPath, { refreshToken })
        .then(({ data }) => data)
        .then(({ accessToken, refreshToken }) => {
          tokens.accessToken = accessToken
          tokens.refreshToken = refreshToken
        }))
    }

    /**
     * The updateHeaders handler will allow the headers to be consistently
     * updated on both the instance and the refreshInstance.
     */
    function updateHeaders(headers: Partial<AxiosRequestHeaders>) {
      const instanceHeaders = {
        ...instance.defaults.headers.common,
        ...(headers as AxiosRequestHeaders),
      }
      Object.keys(instanceHeaders).forEach(
        (key) => instanceHeaders[key] === undefined && delete instanceHeaders[key],
      )
      instance.defaults.headers.common = instanceHeaders

      const refreshHeaders = {
        ...refreshInstance.defaults.headers.common,
        ...(headers as AxiosRequestHeaders),
      }
      Object.keys(refreshHeaders).forEach(
        (key) => refreshHeaders[key] === undefined && delete refreshHeaders[key],
      )
      refreshInstance.defaults.headers.common = refreshHeaders
    }

    /**
     * The stepUp handler takes care of the step up authentication required
     * for a step up payment - adds transactionId as a header and calls the
     * step up api with credentials to authenticate user
     */
    async function stepUp(
      username?: string,
      passcode?: string,
    ): Promise<AxiosResponse<unknown, unknown>> {
      if (!stepUpPayload.config && !stepUpPayload.transactionId) {
        return Promise.reject()
      }
      const payload =
        username && passcode
          ? { username, passcode }
          : { refreshToken: tokens.refreshToken, authenticationMethod: 'BIOMETRIC' }

      const headers = {
        ...(stepUpPayload?.transactionId
          ? { 'X-TransactionId': `${stepUpPayload.transactionId}` }
          : undefined),
      }
      return instance.post(stepupPath, payload, { headers }).then(() =>
        instance
          .request(stepUpPayload.config as unknown as AxiosRequestConfig)
          .finally(() => {
            stepUpPayload.config = undefined
            stepUpPayload.transactionId = undefined
            stepUpPayload.authenticationMethods = undefined
          }),
      )
    }

    /**
     * Return the API headers with API key and authorization token,
     * if found
     */
    function getApiHeaders() {
      return {
        ...(apiKey ? { 'X-ApiKey': apiKey } : undefined),
        ...(tokens.accessToken
          ? { Authorization: `Bearer ${tokens.accessToken}` }
          : undefined),
      }
    }

    /**
     * Add the refreshToken, updateHeaders, getApiHeaders and stepUp handlers
     * to the instance and the instance to the ApiConnector on its name
     */
    instance.refreshToken = refreshToken
    instance.updateHeaders = updateHeaders
    instance.getApiHeaders = getApiHeaders
    instance.stepUp = stepUp

    instances[name] = instance
    return instance
  }

  /**
   * Return an axios instance based on the `name`.
   * This is a singleton. If the instance do not exists for that name, it will be created
   * using the suplied config. If the instance existis and a config is supplied then
   * the instance will be recreated with the new config.
   * @param name the name of the connection instance.
   * @param config the config for that instance.
   */
  function getInstance(
    name = 'default',
    config?: ConnectionConfig,
  ): ExtendedAxiosInstance {
    return config ? createInstance(name, config) : instances[name]
  }

  return Object.freeze({
    getInstance,
  })
})()

export { ApiConnector, ConnectionConfig }

/**
 * Helper method to contain possible exceptions raised by Axios.
 * Example of usage:
 *    const { response, error } = to(ApiConnector.getInstance().get('/products'))
 * @param promise the axios request
 * @returns an object with possible response or error
 */
export async function to<T>(promise: Promise<T>): Promise<AsyncResponse<T>> {
  try {
    const response = await promise
    return { response }
  } catch (error) {
    return { error: (error as ErrorResponse)?.response?.data }
  }
}

/**
 * Generate an idempotencyKey from the request URL and payload. The returned string
 * is a uuidv4 format.
 * Inspired from cyrb53, a very fast, high quality, 53-bit hash algorithm.
 * @param data request payload; string or object
 * @param url request URL, string, optional
 * @returns unique 32 bytes uuidv4 hash
 */
export function idempotencyKeyFrom(data: unknown, url?: string): string {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57,
    h3 = 0xfeadcabe,
    h4 = 0x93a5f713

  const str = typeof data === 'string' ? data + url : JSON.stringify(data) + url

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ char, 2654435761)
    h2 = Math.imul(h2 ^ char, 1597334677)
    h3 = Math.imul(h3 ^ char, 5754853343)
    h4 = Math.imul(h4 ^ char, 3367900313)
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  h3 = Math.imul(h3 ^ (h3 >>> 16), 1500450271) ^ Math.imul(h4 ^ (h4 >>> 13), 9576890767)
  h4 = Math.imul(h4 ^ (h4 >>> 16), 1500450271) ^ Math.imul(h3 ^ (h3 >>> 13), 9576890767)

  const hash =
    (h4 >>> 0).toString(16).padStart(8, '0') +
    (h3 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')

  return 'xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, (_, p) => hash[p % 32])
}

function updateResponseTime(config: ConfigMetaData) {
  config.metadata = {
    ...config.metadata,
    duration: +new Date() - ((config.metadata?.startTime as number) ?? 0),
  }
}
