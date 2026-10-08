# Higgsfield integration

Server-side Node.js 22+ starter using the official `@higgsfield/client/v2` SDK. The provided project directory was empty; this adds a reusable adapter and CLI, without choosing a web framework.

## Setup

```sh
npm install
cp .env.example .env
# Fill HF_CREDENTIALS in .env with key-id:key-secret
npm run generate -- examples/input.json
```

Credentials are not required to run `npm test`. Keep `.env` out of version control and use a server secret manager in deployment. Never expose credentials through browser code or public environment variables.

## Switch models

Set `HF_MODEL` in `.env`, supply the model ID on the command line, or pass `model` to the adapter. No model catalog, input schema, or output format is hardcoded:

```sh
npm run generate -- path/to/model-input.json provider/model/version
# Return immediately after submission; save the returned request_id:
npm run generate -- path/to/model-input.json provider/model/version submit
```

Discover models at https://console.higgsfield.ai and use the chosen model's documentation for its exact endpoint and input JSON. Different models require different parameters; switching IDs does not make their schemas interchangeable. Availability depends on your account and the selected production or preview endpoint. This adapter targets the production API.

## Use in server code

```js
import { createIntegration } from './src/higgsfield.js';

const api = await createIntegration(); // Credentials from server environment
const submitted = await api.submit({
  model: 'higgsfield-ai/soul/v2/standard',
  input: { prompt: 'Editorial portrait in soft daylight' },
});
const status = await api.status(submitted.request_id);
// Once completed:
const fullResult = await api.result(submitted.request_id);
// Cancel only while queued:
// await api.cancel(submitted.request_id);
```

`generate({model, input})` uses SDK polling and returns the complete SDK response. `submit` returns without polling. `status`, `result`, and `cancel` use the documented HTTP lifecycle endpoints because the v2 SDK exposes subscription rather than standalone lifecycle methods. Completed status responses include outputs. Failed or moderated generations are terminal states; inspect `status` before treating the response as successful. A polling timeout stops the local wait and does not cancel remote work. Prefer submission plus persistent request IDs for long-running jobs.

For media inputs, call `api.upload(buffer, 'image/png')`, then pass the returned public URL in the parameter required by the chosen model. Presigned uploads forward all supplied storage headers without API credentials. Public HTTPS media URLs can also be passed directly.

An optional `webhook` object is forwarded to the SDK by `submit`. This starter does not host a webhook receiver or verify webhook signatures; implement those according to the official webhook documentation before using event-driven delivery.

Timeout and polling settings are in `.env.example`. Automatic generation submission retries are disabled to avoid duplicate charges after ambiguous failures. Save request IDs and check status before resubmitting. HTTP lifecycle errors expose `statusCode`; SDK errors propagate to callers, so avoid logging full error objects containing request headers.

## Verification and remaining setup

`npm test` exercises arbitrary models and inputs, raw outputs, credentials, lifecycle requests, and upload credential isolation using offline test doubles. Package installation and live SDK execution were blocked by the workspace's unreachable network proxy during setup. Install dependencies when connectivity is restored; no lockfile was fabricated. Live generation also requires valid credentials and API egress to `api.higgsfield.ai`; media uploads additionally require the storage host returned by the API. Account access and model-specific requests remain to be verified with credentials.

## Official references

- SDK: https://docs.higgsfield.ai/docs/how-to/sdk
- SDK source: https://github.com/higgsfield-ai/higgsfield-js
- Documentation index/model discovery: https://docs.higgsfield.ai/docs/llms.txt
- Cancellation: https://docs.higgsfield.ai/docs/api-reference/requests/cancel-a-queued-request
- Uploads: https://docs.higgsfield.ai/docs/concepts/file-uploads

The SDK source package declares version 0.2.6, which is pinned here. Published package availability could not be checked from this environment.
