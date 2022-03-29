# ApiConnector lite
An [axios](https://github.com/axios/axios)-based API connector to handle complex aspects of real-life APIs. 
This API connector can be used with any Javascript framework currently supported by [axios](https://github.com/axios/axios).
# Features
1. **Mutiple instances** - support multiple instances for multiple APIs.
2. **JWT / Bearer Authentication** - for any request which return `accessToken` and `refreshToken`, those are internally stored. The `accessToken` will be included in the headers as `Bearer` token for all requests. The `refreshToken` will be internally used for `/v1/oauth2/refresh` endpoint.
3. **Retry on Timeout** - if a request will timeout, either by the server or with `504 Gateway timeout` it will be automatically retried with increased timeout.
4. **Idempotency Support** - all `POST`, `PUT` and `PATCH` requests will automatically include an idempotency key in the header (`Idempotency-Key`) as a hash build from the request's URL and payload, in `uuidv4` format.
5. **Cancel Repeated Requests** - if an identical request is sent more than once, either future requests will be canceled until the initial one responded or the existing will be canceled and the new one will be processed.
6. **StepUp Support** - Require users to authenticate with a stronger mechanism to access sensitive information or perform certain transactions.
7. **Support for Reactotron** - For Cryptomathic-enabled API environments, this might be helpful to log all API requests. Check the `Reactotron` site on how to install and use it.
# Instalation
You can use either `npm` or `yarn` to add it to your project.
`yarn add api-connector-lite` or `npm install api-connector-lite`
- Supports `node`, browser, and `react-native`
- Built with TypeScript
- Depends on [axios](https://github.com/axios/axios)
# Quick Start
```javascript
// in main or config file
import { ApiConnector } from 'api-connector-lite'

ApiConnector.getInstance('default', {
  baseURL: 'https://my-platform.com/v1',
  apiKey: 'the-api-key-to-use-for-this-server',
  cancelOldRequests: true, // cancel all pending request for search autocomplete
})

// later, maybe in another file
import { ApiConnector } from 'api-connector-lite'

const result = await ApiConnector.getInstance().get('/products').then(response => response?.data)
```
# Documentation
## Import
You can import the API connector in any of your `.js` or `.ts` file.
```javascript
import { ApiConnector } from 'api-connector-lite'
```
## Initialisation
**ApiConnector** supports multiple **[axios](https://github.com/axios/axios)** instances by using different connection names. The name for the implicit instance is `default`.
## Initialise ApiConnection
### Initialise default instance
The implicit instance is using the reserved `default` name.
```javascript
ApiConnector.getInstance('default', {
  baseURL: 'https://my-platform.com/v1',
  apiKey: 'the-api-key-to-use-for-this-environment',
  autoRefreshToken: false, // turn off autoRefresh
  useIdempotency: false, // turn off idempotency support
  cancelOldRequests: false, // cancel new requests
  stepUpAuthEnabled: true, // enable stepUpAuth
  retryOnTimeout: false, // disable timeout retries
  useResponseTime: true, // enable response time calculation
})
```
You can call the `.getInstance('default', {...})` multiple times to overwrite certain options.
**Note**: The `default` name is only required when initializing the implicit instance. When calling the instance the `default` name can be omitted.
Once the initialisation is done, the **ApiConnector** can be used like this a classic **[axios](https://github.com/axios/axios#instance-methods)** instance:
```javascript
const instance = ApiConnector.getInstance()
const response = await instance.get('/products')
```
or shorter,
```javascript
const response = await ApiConnector.getInstance().get('/products')
```
### Initialise suplemental connections
Suplemental connections can be initialised by using different names. Please remember that the name `default` is reserved for the default instance.
```javascript
ApiConnector.getInstance('legacy', {
  baseURL: 'https://my-legacy-platform.com/v2',
  apiKey: 'the-api-key-to-use-for-this-legacy-environment,
})
```
You can call the `.getInstance('legacy', {...})` multiple times to overwrite certain options.

**Note**: For all other instances except the default one, you need to specify the same name used at initialization when you want to use them.

Once the initialisation is done, the **ApiConnector** can be used like a classic **[axios](https://github.com/axios/axios#instance-methods)** instance quoting its name:
```javascript
const legacyInstance = ApiConnector.getInstance('legacy')
const response = await legacyInstance.get('/products')
```
or shorter,
```javascript
const response = await ApiConnector.getInstance('legacy').get('/products')
```
### Initialisation options
The following options can be used on top of the [**axios** options](https://github.com/axios/axios#request-config):
- `autoRefreshToken` - flag to enable token refresh if `401` status code is returned with certain response code; default `true`
- `retryOnTimeout` - flag to enable request retry on timeout. Timeout can happen either if the server response is not received in due time or if the server responds with status code `504` `Gateway timeout`. The request will retry with a temporary timeout increase of 10 folds and stops before reaching 60sec; default `true`
- `useIdempotency` - enable static idempotency key calculation based on payload for `post`, `put` and `patch` methods; default `true`
- `cancelOldRequests` - enable repeated request cancellation; if the current request did not completeded before a new same request was made, either the existing request or the new request will be cancelled, depending on this flag's value; default `undefined` (disabled).
- `stepUpAuthEnabled` - flag to enable StepUp Authentication (reauthentication with user/password) before the request will be processed; defaut `false`
- `useResponseTime` - flag to enable the response time calculation for both request success or error. The duration of the request can be found in the `config.metadata.duration` of `response` or `error` object; default: `false`
- `tron` - an optional instance of `Reactotron` after being configured for logging; this might be useful for API requests logging when this component in a web app; default `undefined`

**Note**: Don't forget to add **axios** mandatory parameter `baseURL`.
## Usage examples
The **ApiConnector** instances are **axios** instances so they can be used as expected.
### GET method
```javascript
const response = await ApiConnector.getInstance()
    .get('/products')
    .then((result) => result?.data)
    .catch(console.error)
```
### POST method
```javascript
const response = await ApiConnector.getInstance()
    .post('/conversations', { messages })
    .then((result) => result?.data)
    .catch(console.error)
```
### PUT method
```javascript
const response = await ApiConnector.getInstance()
    .put('/conversations', { messages })
    .then((result) => result?.data)
    .catch(console.error)
```
### PATCH method
```javascript
const response = await ApiConnector.getInstance()
    .patch('/conversations', { messages })
    .then((result) => result?.data)
    .catch(console.error)
```
### DELETE method
```javascript
const wasDeleted = await ApiConnector.getInstance()
    .delete(`/conversations/${id}`)
    .then((result) => [202, 204].includes(result?.status))
    .catch(console.error)
```
## Special methods
The returned **axios** instance was enhanced with some utility functions one can find useful.
### refreshToken
Although the authentication tokens are refreshed when needed, there may be certain cases where you may want to force authentication tokens refresh. For that you can call:
```javascript
ApiConnector.getInstance().refreshToken()
```
### updateHeaders
There may be cases you want to add or update certain headers while preserving the authentication tokens. Thus, reinitialising the instance is not a viable solution. For that you can call, for example:
```javascript
ApiConnector.getInstance().updateHeaders({ 'x-device-id': '000-111-222-333-999' })
```
### getApiHeaders
There are cases you want to make a request outside the **ApiConnector** instances, such as using `PDFReader` to access remote `pdf` files. For that you need to pass the authentication token and the API key, but these are kept internally in the **ApiConnector** instances. To get the authetication headers you can use:
```javascript
const headers = ApiConnector.getInstance().getApiHeaders()
```
The `headers` will contain both `X-ApiKey` and `Authorization` headers. Keep in mind that the `Authorization` header changes in time so you need to repeteadly call `getApiHeaders()` method for the updated value.
### stepUp
If the `stepUpAuthEnabled` option is enabled and a request responded with status code `403 Forbidden` and there is a `transactionId` value present in the `response.data`, then the request can be retried by calling the `stepUp` method. This assumes the presence of an endpoint `/v1/oauth2/stepup`. This endpoint is accepting `X-TransactionId` in headers and either `username` and `passcode` or `refreshToken` and `authenticationMethod: 'BIOMETRIC'` as payload.
When calling `stepUp` method, if the `username` and `passcode` are not provided, then the `refreshToken` and `authenticationMethod: 'BIOMETRIC'` will be used instead. This will force a reauthentication before the original request will be retried.
```javascript
const response = await ApiConnector.getInstance().stepUp()
```
or
```javascript
const response = await ApiConnector.getInstance().stepUp(username, passcode)
```
## Why ApiConnectorLite?
The `ApiConnector` (for now in a private github repo) includes an `HTTP` adapter from  **[Cryptomathic](https://www.cryptomathic.com/)** which can optionally replace the current **[axios](https://github.com/axios/axios)** one, for increased, banking-grade security. This is not an opensource software, thus the private repo.
# Important Note
The `api-connector-lite` depends on `axios` **v0.26.0** which have a typescript issue by not including the **`AxiosInterceptorOptions `** in the `index.d.ts` file. You may need to patch this file if the tests are failing. For that you need to update the `index.d.ts` file in your axios's `node_module` folder with the one from the `axios` github repo.
