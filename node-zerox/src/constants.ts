export const ASPECT_RATIO_THRESHOLD = 5;

import fetch from 'node-fetch';
import { LangfuseMetadata } from './types';

// This is a rough guess; this will be used to create Tesseract workers by default,
// that cater to this many pages. If a document has more than this many pages,
// then more workers will be created dynamically.

export const NUM_STARTING_WORKERS = 3;
export const CONSISTENCY_PROMPT = (priorPage: string): string =>
  `Markdown must maintain consistent formatting with the following page: \n\n """${priorPage}"""`;


// This is the system prompt that will be used to convert documents to markdown.
export let SYSTEM_PROMPT_BASE = '';
export let LANGFUSE_METADATA: LangfuseMetadata | undefined;

const DEFAULT_SYSTEM_PROMPT = `
Convert the following document to markdown.
Return only the markdown with no explanation text. Do not include delimiters like \`\`\`markdown or \`\`\`html.

RULES:
  - You must include all information on the page. Do not exclude headers, footers, or subtext.
  - Return tables in an HTML format.
  - Charts & infographics must be interpreted to a markdown format. Prefer table format when applicable.
  - Logos should be wrapped in brackets. Ex: <logo>Coca-Cola<logo>
  - Watermarks should be wrapped in brackets. Ex: <watermark>OFFICIAL COPY<watermark>
  - Page numbers should be wrapped in brackets. Ex: <page_number>14<page_number> or <page_number>9/22<page_number>
  - Prefer using ☐ and ☑ for check boxes.
`;

// Get the system prompt from Langfuse or use default
// This is a one-time operation, and the prompt is stored in memory
// for the lifetime of the server.
export const fetchSystemPrompt = async (): Promise<void> => {
  const host = process.env.LANGFUSE_HOST?.replace(/\/$/, '');
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const promptName = process.env.LANGFUSE_PROMPT_NAME;

  const useLangfuse = host && publicKey && secretKey && promptName;

  if (!useLangfuse) {
    console.log('Langfuse configuration missing or incomplete. Using default system prompt.');
    SYSTEM_PROMPT_BASE = DEFAULT_SYSTEM_PROMPT;
    LANGFUSE_METADATA = undefined; // Ensure metadata is also reset/cleared
    return; // Exit early as we are using the default
  }

  // Proceed with Langfuse fetch only if all variables are set
  console.log('Langfuse configuration found. Attempting to fetch system prompt:', {
    host,
    publicKey,
    promptName,
    // Not logging secretKey for security
  });

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
      console.error(`Failed to fetch system prompt from Langfuse: ${response.statusText}. Error: ${errorText}. Falling back to default prompt.`);
      SYSTEM_PROMPT_BASE = DEFAULT_SYSTEM_PROMPT; // Fallback on fetch error
      LANGFUSE_METADATA = undefined;
      return; // Exit after fallback
      // Or rethrow if you want the server startup to fail on Langfuse error:
      // throw new Error(`Failed to fetch system prompt: ${response.statusText}`);
    }

    const data = await response.json() as ({ prompt: string } & LangfuseMetadata);
    console.log('Received data from Langfuse:', data);

    if (!data || !data.prompt) {
      console.error('Invalid data received from Langfuse. Falling back to default prompt.');
      SYSTEM_PROMPT_BASE = DEFAULT_SYSTEM_PROMPT; // Fallback on invalid data
      LANGFUSE_METADATA = undefined;
      return; // Exit after fallback
      // Or rethrow:
      // throw new Error('No prompt found in Langfuse response');
    }

    const { prompt, ...metadata } = data;
    console.log('Setting prompt and metadata from Langfuse:', { promptLength: prompt.length, metadata });
    SYSTEM_PROMPT_BASE = prompt;
    LANGFUSE_METADATA = metadata;
  } catch (error) {
    console.error('Error during fetchSystemPrompt from Langfuse:', error, 'Falling back to default prompt.');
    SYSTEM_PROMPT_BASE = DEFAULT_SYSTEM_PROMPT; // Fallback on general catch error
    LANGFUSE_METADATA = undefined;
    // Depending on requirements, you might want to rethrow the error here
    // to indicate a potential configuration or network issue,
    // rather than silently falling back.
    // throw error;
  }
};
