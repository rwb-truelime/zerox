import fetch from 'node-fetch';
import { LangfuseMetadata } from './types';

// This is a rough guess; this will be used to create Tesseract workers by default,
// that cater to this many pages. If a document has more than this many pages,
// then more workers will be created dynamically.

export const NUM_STARTING_WORKERS = 3;
export const CONSISTENCY_PROMPT = (priorPage: string): string =>
  `Markdown must maintain consistent formatting with the following page: \n\n """${priorPage}"""`;

export let SYSTEM_PROMPT_BASE = '';
export let LANGFUSE_METADATA: LangfuseMetadata | undefined;

// Get the system prompt from Langfuse
// This is a one-time operation, and the prompt is stored in memory
// for the lifetime of the server.
export const fetchSystemPrompt = async (): Promise<void> => {
  const host = process.env.LANGFUSE_HOST?.replace(/\/$/, '');
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const promptName = process.env.LANGFUSE_PROMPT_NAME;

  if (!host || !publicKey || !secretKey || !promptName) {
    throw new Error('Missing Langfuse configuration');
  }

  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
  
  const response = await fetch(
    `${host}/api/public/v2/prompts/${promptName}`,
    {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch system prompt: ${response.statusText}`);
  }

  const data = await response.json() as Array<{prompt: string} & LangfuseMetadata>;
  if (!data.length) {
    throw new Error('No prompt found');
  }

  const { prompt, ...metadata } = data[0];
  SYSTEM_PROMPT_BASE = prompt;
  LANGFUSE_METADATA = metadata;
};
