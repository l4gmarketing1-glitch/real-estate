import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntegration } from '../src/higgsfield.js';

const env = { HF_CREDENTIALS: 'test-id:test-secret', HF_MODEL: 'provider/default/model' };
test('passes arbitrary model inputs and preserves all outputs', async () => {
  const calls = [];
  const output = { status: 'completed', audio: { url: 'audio' }, custom: [1, 2] };
  const api = await createIntegration({ env, sdkFactory: config => {
    assert.equal(config.maxRetries, 0);
    return { subscribe: async (...args) => { calls.push(args); return output; } };
  } });
  const input = { audio_url: 'https://example.com/a.wav', unusual_parameter: { value: true } };
  assert.equal(await api.generate({ model: 'new-provider/future-model/v3', input }), output);
  assert.deepEqual(calls[0], ['new-provider/future-model/v3', { input, withPolling: true }]);
  await api.submit({ input });
  assert.equal(calls[1][0], env.HF_MODEL);
  assert.equal(calls[1][1].withPolling, false);
  await assert.rejects(api.generate({ model: 'https://other.example/model', input }));
  await assert.rejects(api.generate({ model: 'provider/../model', input }));
  await assert.rejects(api.generate({ input: [] }));
});
test('fails clearly before loading SDK when credentials or config are missing', async () => {
  await assert.rejects(createIntegration({ env: {} }), /HF_CREDENTIALS/);
  await assert.rejects(createIntegration({ env: { ...env, HF_TIMEOUT_MS: 'bad' } }), /positive integer/);
});
test('status/result and empty cancellation responses use documented lifecycle endpoints', async () => {
  const calls = [];
  const api = await createIntegration({ env, sdkFactory: () => ({}), fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(options.method === 'POST' ? null : JSON.stringify({ status: 'completed', video: { url: 'v' } }), { status: options.method === 'POST' ? 202 : 200 });
  } });
  assert.equal((await api.result('request-123')).video.url, 'v');
  assert.equal(await api.cancel('request-123'), null);
  assert.equal(calls[0].url, 'https://api.higgsfield.ai/requests/request-123/status');
  assert.equal(calls[1].options.method, 'POST');
  assert.throws(() => api.status('../other'));
});
test('uploads forward storage headers without sending API credentials', async () => {
  const calls = [];
  const api = await createIntegration({ env, sdkFactory: () => ({}), fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? Response.json({ upload_url: 'https://storage.example/upload', public_url: 'https://cdn.example/input', upload_headers: { 'Content-Type': 'image/png', 'x-amz-tagging': 'retention=temporary' } }) : new Response(null, { status: 200 });
  } });
  assert.equal(await api.upload(new Uint8Array([1, 2]), 'image/png'), 'https://cdn.example/input');
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers['x-amz-tagging'], 'retention=temporary');
});
