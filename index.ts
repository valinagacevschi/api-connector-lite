import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import * as debugWebAxios from './adapters/debugWebAxios'
import {
  AsyncResponse,
  AxiosErrorWithRetryLogic,
  ConnectionConfig,
  ErrorResponse,
  ExtendedAxiosInstance,
  Headers,
  RefreshTokenResponse,
  StepUpPayload,
} from './types'

const ACCESS_TOKEN_EXPIRED = 401
const REFRESH_PATH = '/v1/oauth2/refresh'
const STEP_UP_REQUIRED = 403
const STEPUP_PATH = '/v1/oauth2/stepup'

const DEFAULT_CONFIG = { timeout: 3000 }
const DEFAULT_HEADERS: Headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}

const ApiConnector = (() => {
  const instances: Record<string, ExtendedAxiosInstance> = {}

  function createInstance(name: string, config: ConnectionConfig): ExtendedAxiosInstance {
    const {
      autoRefreshToken = true,
      useIdempotency = true,
      cancelRepeatedRequests = true,
      stepUpAuthEnabled = false,
      retryOnTimeout = true,
      useReactotron = false,
      headers: inputHeaders,
      ...axiosConfig
    } = config

    const { apiKey } = axiosConfig

    const headers: Headers = {
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

    const stepUpPayload: StepUpPayload = {}

    /**
     * Create main instance. Can be an axios instance or a debugWebAxios instance with reactotron 
     * support for web
     */
    const factory = (window?.location && useReactotron) ? debugWebAxios : axios
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
      runWhen: () => cancelRepeatedRequests,
    })
    /**
     * Add Response Interceptors
     */
    instance.interceptors.response.use(
      cancelResponseInterceptor,
      cancelErrorInterceptor,
      {
        runWhen: () => cancelRepeatedRequests,
      },
    )
    instance.interceptors.response.use(storeTokensInterceptor, refreshTokenInterceptor, {
      runWhen: () => autoRefreshToken,
    })
    instance.interceptors.response.use(undefined, stepUpInterceptor, {
      runWhen: () => stepUpAuthEnabled,
    })
    instance.interceptors.response.use(undefined, timeOutInterceptor, {
      runWhen: () => retryOnTimeout,
    })

    /**
     * Private interceptor
     * Add Authorization header if accessToken was previously set by
     * storeTokensInterceptor
     */
    function authenticationInterceptor(
      requestConfig: AxiosRequestConfig,
    ): AxiosRequestConfig {
      if (requestConfig.headers) {
        requestConfig.headers['Authorization'] = `Bearer ${tokens.accessToken}`
      }
      return requestConfig
    }

    /**
     * Private interceptor
     * Add Idempotency-Key to POST, PUT and PATCH methods
     * Since useIdempotency is a global flag, we might conditionally add
     * the interceptor, instead of checking it at each request.
     * This support will be available in the next AXIOS version.
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
     * requests. If the url was already used it will be canceled and the
     * new request will be performed.
     * Since cancelRepeatedRequests is a global flag, we might
     * conditionally add the interceptor, instead of checking it
     * at each request.
     * This support will be available in the next AXIOS version.
     */
    function cancelRequestInterceptor(
      requestConfig: AxiosRequestConfig,
    ): AxiosRequestConfig {
      const key = requestConfig?.url ?? ''
      if (currentExecutingRequests[key]) {
        const source = currentExecutingRequests[key]
        delete currentExecutingRequests[key]
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
     * currentExecutingRequests object if the cancelRepeatedRequests
     * flag is set.
     * @param response: AxiosResponse<RefreshTokenResponse>
     */
    function cancelResponseInterceptor(
      response: AxiosResponse<RefreshTokenResponse>,
    ): AxiosResponse<RefreshTokenResponse> {
      if (cancelRepeatedRequests) {
        delete currentExecutingRequests[response.request?.responseURL]
      }
      return response
    }

    /**
     * Private interceptor
     * If the request failed because it was canceled, the error will
     * be silently discarded. On any other error, it will remove pending
     * requests from currentExecutingRequests object if the
     * cancelRepeatedRequests flag is set.
     * @param error: AxiosErrorWithRetryLogic
     */
    function cancelErrorInterceptor(error: AxiosErrorWithRetryLogic) {
      if (!cancelRepeatedRequests) {
        return Promise.reject(error)
      }
      if (axios.isCancel(error)) {
        return Promise.resolve()
      }
      const {
        config: { url = '' },
      } = error

      if (currentExecutingRequests[url]) {
        delete currentExecutingRequests[url]
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

        if (accessToken) {
          tokens.accessToken = accessToken
        }
        if (refreshToken) {
          tokens.refreshToken = refreshToken
        }
      }
      return response
    }

    /**
     * Private interceptor
     * If request failed with timeout or 504 timeout.
     * @param error: AxiosErrorWithRetryLogic
     */
     function timeOutInterceptor(error: AxiosErrorWithRetryLogic) {
      const { config, response, code, message } = error
      const { status } = response ?? {}
      if ((code === 'ECONNABORTED' && message.match(/timeout/)) || status === 504) {
        const { timeout, ...request } = config
        if ((timeout ?? 1e10) > 6e4) {
          return Promise.reject(error)
        }
        instance.request({ ...request, timeout: (timeout ?? 1e3) * 10 })
      }
    }

    /**
     * Private interceptor
     * If request failed with status 401 accessToken expiration, refresh tokens.
     * @param error: AxiosErrorWithRetryLogic
     */
    function refreshTokenInterceptor(error: AxiosErrorWithRetryLogic) {
      const { response: { status, data = {} } = {}, config } = error

      if (status === ACCESS_TOKEN_EXPIRED) {
        if (config.didRetry) {
          return Promise.reject(data)
        }
        config.didRetry = true
        return refreshToken()
          .then(() => instance.request(config))
          .catch((e) => console.warn('error', e))
      }
      return Promise.reject(error)
    }

    /**
     * Private interceptor
     * If request failed with status 403 stepup required.
     * @param error: AxiosErrorWithRetryLogic
     */
     function stepUpInterceptor(error: AxiosErrorWithRetryLogic) {
      const { response, config } = error
      const { status, data } = response || {}
      const { transactionId, requestPayload, authenticationMethods } = data || {}

      if (status === STEP_UP_REQUIRED && transactionId) {
        config.headers ??= {}
        config.headers['X-TransactionId'] = `${transactionId}`
        config.data = JSON.stringify({
          ...requestPayload,
          transactionId,
        })
        stepUpPayload.transactionId = transactionId
        stepUpPayload.authenticationMethods = authenticationMethods
        stepUpPayload.config = config
      }
      return Promise.reject(error)
    }

    /**
     * Create a separate axions instance for auth refresh token
     */
     const refreshInstance: AxiosInstance = factory.create({ ...DEFAULT_CONFIG, ...axiosConfig, headers })

    /**
     * The refreshToken handler will be accessible from the instance
     * to be called when we need to force an Auth Token refresh.
     */
    async function refreshToken(): Promise<void> {
      const { refreshToken } = tokens
      return refreshInstance
        .post<RefreshTokenResponse>(REFRESH_PATH, { refreshToken })
        .then(({ data }) => data)
        .then(({ accessToken, refreshToken }) => {
          tokens.accessToken = accessToken
          tokens.refreshToken = refreshToken
        })
    }

    /**
     * The updateHeaders handler will allow the headers to be consistently
     * updated on both the instance and the refreshInstance.
     */
     function updateHeaders(headers: Headers) {
      instance.defaults.headers = {
        ...instance.defaults.headers,
        ...headers,
      }
      refreshInstance.defaults.headers = {
        ...refreshInstance.defaults.headers,
        ...headers,
      }
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
      const payload =
        username && passcode
          ? { username, passcode }
          : { refreshToken: tokens.refreshToken, authenticationMethod: 'BIOMETRIC' }

      const headers = {
        ...(stepUpPayload?.transactionId
          ? { 'X-TransactionId': `${stepUpPayload.transactionId}` }
          : undefined),
      }
      return instance.post(STEPUP_PATH, payload, { headers }).then(() =>
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
  function getInstance(name = 'default', config?: ConnectionConfig): ExtendedAxiosInstance {
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
 * 
 * Generate an idempotencyKey from the request URL and payload. The returned string 
 * is a uuidv4 format.
 * Inspired from cyrb53, a very fast, high quality, 53-bit hash algorithm.
 * @param data request payload; string or object
 * @param url request URL, string, optional
 * @returns unique 32 bytes uuidv4 hash
 */
function idempotencyKeyFrom(data: unknown, url?: string): string {  
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0xfeadcabe, h4 = 0x93a5f713
  
  const str = typeof data === 'string' ? (data + url) : JSON.stringify(data) + url

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
    (h4 >>> 0).toString(16).padStart(8, '0') + (h3 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')

  return 'xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, (_, p) => hash[p % 32])
}
