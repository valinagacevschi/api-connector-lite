import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
} from 'axios'

export type ExtendedAxiosInstance = AxiosInstance & {
  refreshToken: () => Promise<void>
  updateHeaders: (headers: Partial<AxiosRequestHeaders>) => void
  getApiHeaders: () => AxiosRequestHeaders
  stepUp: (username?: string, passcode?: string) => Promise<unknown>
}

export type ConnectionConfig = AxiosRequestConfig & {
  refreshPath?: string
  stepupPath?: string
  apiKey?: string
  autoRefreshToken?: boolean
  stepUpAuthEnabled?: boolean
  useIdempotency?: boolean
  cancelOldRequest?: boolean
  retryOnTimeout?: boolean
  useResponseTime?: boolean
  tron?: ReactotronType
  useEtag?: boolean
  tokensPersist?: (tokens: RefreshTokenResponse) => Promise<unknown>
  tokenRehydrate?: () => Promise<RefreshTokenResponse | undefined>
}

export type AxiosErrorWithRetriableRequestConfig = AxiosError & {
  config: AxiosRequestConfig & ConfigMetaData
}

export interface RefreshTokenResponse {
  accessToken?: string
  refreshToken?: string
}

export interface FetchResult {
  data: Partial<{ code?: string }>
  headers: Record<string, string>
  status: number
  statusText: string
  ok?: boolean
  config: AxiosRequestConfig
}

export interface EnhancedError extends Error {
  config: AxiosRequestConfig
  code: string | number
  response?: FetchResult
  isAxiosError: true
}

export type Resolve = (value: AxiosResponse) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Reject = (reason: any) => void

export interface AdapterOptions {
  method?: string
  body?: string
  headers?: Record<string, string | number | boolean>
}

export type AsyncResponse<T> = {
  response?: T
  error?: ErrorResponse
}

export type ErrorResponse = {
  code?: string | number
  error?: string
  message?: string
  response?: FetchResult
}

export type StepUpPayload = {
  transactionId?: string
  config?: AxiosRequestConfig
  authenticationMethods?: string
}
export type ConfigMetaData = {
  metadata?: Record<string, unknown>
}
export type ReactotronType = {
  display: (config?: unknown) => void
  apiResponse?: (request: unknown, response: unknown, duration: unknown) => void
}
