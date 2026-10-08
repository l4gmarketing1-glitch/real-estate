import { appendFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { createIntegration } from './higgsfield.js';

try {
  const api = await createIntegration();
  let response = await api.submit({ input: JSON.parse(process.env.HF_INPUT_JSON) });
  if (!response.request_id) throw new Error('Submission did not return a request ID');
  console.log(`Request ID: ${response.request_id}`);
  const deadline = Date.now() + 600000;
  while (['queued', 'in_progress'].includes(response.status)) {
    if (Date.now() >= deadline) throw new Error('Polling timed out. Check the saved request ID before submitting again.');
    await setTimeout(3000);
    response = await api.status(response.request_id);
  }
  console.log(`Generation status: ${response.status}`);
  if (response.status !== 'completed') throw new Error('Generation did not complete successfully');
  // Do not log raw SDK error objects or request configuration.
  console.log(JSON.stringify(response, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, 'Higgsfield generation completed successfully. See the Generate once step for the media URLs.\n');
  }
} catch (error) {
  let message = error.message || 'Test failed';
  for (const secret of (process.env.HF_CREDENTIALS || '').split(':')) {
    if (secret) message = message.replaceAll(secret, '[redacted]');
  }
  console.error(message);
  process.exitCode = 1;
}
