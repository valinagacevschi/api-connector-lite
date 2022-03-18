import { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

export interface Headers {
  [key: string]: string
}

export type ExtendedAxiosInstance = AxiosInstance & {
  refreshToken: () => Promise<void>
  updateHeaders: (headers: Headers) => void
  getApiHeaders: () => Headers
  stepUp: (username?: string, passcode?: string) => Promise<unknown>
}

export type ConnectionConfig = AxiosRequestConfig & {
  apiKey?: string
  autoRefreshToken?: boolean
  stepUpAuthEnabled?: boolean
  useIdempotency?: boolean
  cancelOldRequest?: boolean
  retryOnTimeout?: boolean
  useReactotron?: boolean
}

type AxiosRetriableRequestConfig = AxiosRequestConfig & {
  didRetry: boolean
}

export type AxiosErrorWithRetriableRequestConfig = AxiosError & {
  config: AxiosRetriableRequestConfig
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
