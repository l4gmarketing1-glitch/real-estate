/** Server-only adapter. Model input and output remain model-specific. */
export async function createIntegration({ env = process.env, sdkFactory, fetchImpl = fetch } = {}) {
  if (typeof window !== 'undefined') throw new Error('Higgsfield requires a server environment');
  const credentials = env.HF_CREDENTIALS?.trim();
  if (!credentials || !/^[^:\s]+:[^:\s]+$/.test(credentials)) {
    throw new Error('Set HF_CREDENTIALS to key-id:key-secret in the server environment');
  }
  function positive(name, fallback) {
    const value = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
    return value;
  }
  const timeout = positive('HF_TIMEOUT_MS', 120000);
  const config = {
    credentials, timeout,
    // Do not automatically repeat billable submissions after ambiguous failures.
    maxRetries: 0,
    pollInterval: positive('HF_POLL_INTERVAL_MS', 2000),
    maxPollTime: positive('HF_MAX_POLL_TIME_MS', 600000),
  };
  const factory = sdkFactory ?? (await import('@higgsfield/client/v2')).createHiggsfieldClient;
  const client = factory(config);
  function modelId(model) {
    const value = model ?? env.HF_MODEL;
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)+$/.test(value)
      || value.split('/').some(part => part === '.' || part === '..')) {
      throw new Error('Provide a relative Higgsfield model ID, such as higgsfield-ai/soul/v2/standard');
    }
    return value;
  }
  function inputObject(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('input must be a JSON object');
  }
  async function request(path, method = 'GET', body) {
    const response = await fetchImpl(`https://api.higgsfield.ai${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(timeout),
      headers: { Authorization: `Key ${credentials}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      // Do not expose headers, credentials, or raw upstream error bodies.
      const error = new Error(`Higgsfield API request failed (HTTP ${response.status})`);
      error.statusCode = response.status;
      throw error;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  function requestPath(id, action) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid request ID');
    return `/requests/${id}/${action}`;
  }
  async function submit({ model, input, webhook } = {}, withPolling = false) {
    const endpoint = modelId(model);
    inputObject(input);
    if (webhook) {
      if (new URL(webhook.url).protocol !== 'https:') throw new Error('Webhook must use HTTPS');
    }
    return client.subscribe(endpoint, { input, withPolling, ...(webhook ? { webhook } : {}) });
  }
  return {
    submit: options => submit(options, false),
    generate: options => submit(options, true),
    status: id => request(requestPath(id, 'status')),
    // Completed status responses contain the model outputs; no invented result endpoint.
    async result(id) {
      const result = await request(requestPath(id, 'status'));
      if (result.status !== 'completed') throw new Error(`Request is ${result.status}; no completed result available`);
      return result;
    },
    cancel: id => request(requestPath(id, 'cancel'), 'POST'),
    async upload(bytes, contentType) {
      if (!(bytes instanceof Uint8Array)) throw new Error('Upload requires Buffer or Uint8Array');
      const ticket = await request('/files/generate-upload-url', 'POST', { content_type: contentType });
      if (new URL(ticket.upload_url).protocol !== 'https:') throw new Error('Upload URL must use HTTPS');
      const response = await fetchImpl(ticket.upload_url, {
        method: 'PUT', redirect: 'error', headers: ticket.upload_headers,
        body: bytes, signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw new Error(`Media upload failed (HTTP ${response.status})`);
      return ticket.public_url;
    },
  };
}
