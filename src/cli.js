import { readFile } from 'node:fs/promises';
import { createIntegration } from './higgsfield.js';

try {
  const [inputFile, model, mode = 'generate'] = process.argv.slice(2);
  if (!inputFile || !['generate', 'submit'].includes(mode)) {
    throw new Error('Usage: npm run generate -- input.json [model-id] [generate|submit]');
  }
  const input = JSON.parse(await readFile(inputFile, 'utf8'));
  const api = await createIntegration();
  console.log(JSON.stringify(await api[mode]({ model, input }), null, 2));
} catch (error) {
  // SDK errors may include HTTP request details. Never dump those objects.
  const credentials = process.env.HF_CREDENTIALS;
  let message = error.message || 'Generation failed';
  for (const secret of credentials ? [credentials, ...credentials.split(':')] : []) {
    if (secret) message = message.replaceAll(secret, '[redacted]');
  }
  console.error(message);
  process.exitCode = 1;
}
