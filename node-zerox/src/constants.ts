export const ASPECT_RATIO_THRESHOLD = 5;

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

  console.log('Langfuse configuration:', {
    host,
    publicKey,
    promptName,
    // Not logging secretKey for security
  });

  if (!host || !publicKey || !secretKey || !promptName) {
    console.error('Missing configuration:', {
      hasHost: !!host,
      hasPublicKey: !!publicKey,
      hasSecretKey: !!secretKey,
      hasPromptName: !!promptName,
    });
    throw new Error('Missing Langfuse configuration');
  }

  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
  console.log('Making request to:', `${host}/api/public/v2/prompts/${promptName}`);
  
  try {
    const response = await fetch(
      `${host}/api/public/v2/prompts/${promptName}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Failed to fetch system prompt: ${response.statusText}`);
    }

    // Changed this part to handle single object instead of array
    const data = await response.json() as ({ prompt: string } & LangfuseMetadata);
    console.log('Received data:', data);

    if (!data || !data.prompt) {
      console.error('Invalid data received');
      throw new Error('No prompt found');
    }

    const { prompt, ...metadata } = data;
    console.log('Setting prompt and metadata:', { promptLength: prompt.length, metadata });
    SYSTEM_PROMPT_BASE = prompt;
    LANGFUSE_METADATA = metadata;
  } catch (error) {
    console.error('Error in fetchSystemPrompt:', error);
    throw error;
  }
};
