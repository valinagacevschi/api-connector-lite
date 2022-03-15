# ApiConnector lite
An [axios](https://github.com/axios/axios)-based API connector to handle complex aspects of real-life APIs. 
This API connector can be used with any Javascript framework currently supported by [axios](https://github.com/axios/axios).

## Instalation
You can use either `npm` or `yarn` to add it to your project.
`yarn add api-connector-lite` or `npm install api-connector-lite`

## Usage
### Import
You can import the API connector in any of your `.js` or `.ts` file.
```
import ApiConnector from 'api-connector-lite'
```
### Initialisation
**ApiConnector** supports multiple **[axios](https://github.com/axios/axios)** instances by using different connection names. The name for the implicit instance is `default`.
### Initialise ApiConnection
#### Initialise default instance
The implicit instance is using the reserved `default` name.
```
ApiConnector.getInstance('default', {
  baseURL: 'https://my-platform.com/v1',
  apiKey: 'the-api-key-to-use-for-this-environment,
  autoRefreshToken: true,
  useIdempotency: true,
  cancelRepeatedRequests: true,
  stepUpAuthEnabled: true,
  retryOnTimeout: true,
})
```
You can call the `.getInstance('default', {...})` multiple times to overwrite certain options.
**Note**: The `default` name is only required when initializing the implicit instance. When calling the instance the `default` name can be omitted.
Once the initialisation is done, the **ApiConnector** can be used like this a classic **[axios](https://github.com/axios/axios#instance-methods)** instance:
```
const instance = ApiConnector.getInstance()
const response = await instance.get('/products'))
```
or shorter,
```
const response = await ApiConnector.getInstance().get('/products'))
```
#### Initialise suplemental connections
Suplemental connections can be initialised by using different names. Please remember that the name `default` is reserved for the default instance.
```
ApiConnector.getInstance('legacy', {
  baseURL: 'https://my-legacy-platform.com/v2',
  apiKey: 'the-api-key-to-use-for-this-legacy-environment,
})
```
You can call the `.getInstance('legacy', {...})` multiple times to overwrite certain options.

**Note**: For all other instances except the default one, you need to specify the same name used at initialization when you want to use them.

Once the initialisation is done, the **ApiConnector** can be used like a classic **[axios](https://github.com/axios/axios#instance-methods)** instance quoting its name:
```
const legacyInstance = ApiConnector.getInstance('legacy')
const response = await legacyInstance.get('/products'))
```
or shorter,
```
const response = await ApiConnector.getInstance('legacy').get('/products'))
```
#### Initialisation options
The following options can be used on top of the [**axios** options](https://github.com/axios/axios#request-config):
- `autoRefreshToken` - flag to enable token refresh if `401` status code is returned with certain response code; default `true`
- `retryOnTimeout` - flag to enable request retry on timeout. Timeout can happen either if the server response is not received in due time or if the server responds with status code `504` `Gateway timeout`. The request will retry with a temporary timeout increase of 10 folds and stops before reaching 60sec; default `true`
- `useIdempotency` - enable static idempotency key calculation based on payload for `post`, `put` and `patch` methods; default `true`
- `cancelRepeatedRequests` - enable repeated request cancellation; if the current request did not completeded before a new same request was made, it will be cancelled, favouring the new one.
- `stepUpAuthEnabled` - flag to enable StepUp Authentication (reauthentication with user/password) before the request will be processed; defaut `false`
- `useReactotron` - flag to enable **[Reactotron](https://github.com/infinitered/reactotron)** debugging for web apps. This is not required for `react-native` projects, as **Reactotron** is automatically supported if correctly imported and configured; default `false`

**Note**: Don't forget to add **axios** mandatory parameter `baseURL`.
### Usage examples
The **ApiConnector** instances are **axios** instances so they can be used as expected.
#### GET method
```
const response = await ApiConnector.getInstance()
    .get('/products')
    .then((result) => result?.data)
    .catch(console.error)
```
#### POST method
```
const response = await ApiConnector.getInstance()
    .post('/conversations', { messages })
    .then((result) => result?.data)
    .catch(console.error)
```
#### PUT method
```
const response = await ApiConnector.getInstance()
    .put('/conversations', { messages })
    .then((result) => result?.data)
    .catch(console.error)
```
#### PATCH method
```
const response = await ApiConnector.getInstance()
    .patch('/conversations', { messages })
    .then((result) => result?.data)
    .catch(console.error)
```
#### DELETE method
```
const wasDeleted = await ApiConnector.getInstance()
    .delete(`/conversations/${id}`)
    .then((result) => [202, 204].includes(result?.status))
    .catch(console.error)
```
### Special methods
The returned **axios** instance was enhanced with some utility functions one can find useful.
#### refreshToken
Although the authentication tokens are refreshed when needed, there may be certain cases where you may want to force authentication tokens refresh. For that you can call:
```
ApiConnector.getInstance().refreshToken()
```
#### updateHeaders
There may be cases you want to add or update certain headers while preserving the authentication tokens. Thus, reinitialising the instance is not a viable solution. For that you can call, for example:
```
ApiConnector.getInstance().updateHeaders({ 'x-device-id': '000-111-222-333-999' })
```
#### getApiHeaders
There are cases you want to make a request outside the **ApiConnector** instances, such as using `PDFReader` to access remote `pdf` files. For that you need to pass the authentication token and the API key, but these are kept internally in the **ApiConnector** instances. To get the authetication headers you can use:
```
const headers = ApiConnector.getInstance().getApiHeaders()
```
The `headers` will contain both `X-ApiKey` and `Authorization` headers. Keep in mind that the `Authorization` header changes in time so you need to repeteadly call `getApiHeaders()` method for the updated value.
#### stepUp
If the `stepUpAuthEnabled` option is enabled and a request responded with status code `403 Forbidden` and there is a `transactionId` value present in the `response.data`, then the request can be retried by calling the `stepUp` method. This assumes the presence of an endpoint `/v1/oauth2/stepup` which takes `username` and `passcode` as payload and `X-TransactionId` in headers.
When calling `stepUp` method, the `username` and `passcode` should be provided. This will force a reauthentication before the original request will be retried.

## Why ApiConnectorLite?
The `ApiConnector` (for now in a private github repo) includes an `HTTP` adapter from  **[Cryptomathic](https://www.cryptomathic.com/)** which can optionally replace the current **[axios](https://github.com/axios/axios)** one, for increased, banking-grade security. This is not an opensource software, thus the private repo.
