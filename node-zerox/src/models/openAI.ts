import {
  CompletionArgs,
  CompletionResponse,
  ExtractionArgs,
  ExtractionResponse,
  MessageContentArgs,
  ModelInterface,
  OpenAICredentials,
  OpenAILLMParams,
  OperationMode,
} from "../types";
import {
  cleanupImage,
  convertKeysToCamelCase,
  convertKeysToSnakeCase,
  encodeImageToBase64,
} from "../utils";
import { CONSISTENCY_PROMPT, SYSTEM_PROMPT_BASE } from "../constants";
import OpenAI from "openai";
import fs from "fs-extra";

export default class OpenAIModel implements ModelInterface {
  private client: OpenAI;
  private model: string;
  private llmParams?: Partial<OpenAILLMParams>;

  constructor(
    credentials: OpenAICredentials,
    model: string,
    llmParams?: Partial<OpenAILLMParams>
  ) {
    this.client = new OpenAI({ apiKey: credentials.apiKey });
    this.model = model;
    this.llmParams = llmParams;
  }

  async getCompletion(
    mode: OperationMode,
    params: CompletionArgs | ExtractionArgs
  ): Promise<CompletionResponse | ExtractionResponse> {
    const modeHandlers = {
      [OperationMode.EXTRACTION]: () =>
        this.handleExtraction(params as ExtractionArgs),
      [OperationMode.OCR]: () => this.handleOCR(params as CompletionArgs),
    };

    const handler = modeHandlers[mode];
    if (!handler) {
      throw new Error(`Unsupported operation mode: ${mode}`);
    }

    return await handler();
  }

  private async createMessageContent({
    input,
    options,
  }: MessageContentArgs): Promise<OpenAI.Chat.Completions.ChatCompletionContentPart[]> {
    const processImages = async (imagePaths: string[]) => {
      const nestedImages = await Promise.all(
        imagePaths.map(async (imagePath) => {
          const imageBuffer = await fs.readFile(imagePath);
          const buffers = await cleanupImage({
            correctOrientation: options?.correctOrientation ?? false,
            imageBuffer,
            scheduler: options?.scheduler ?? null,
            trimEdges: options?.trimEdges ?? false,
          });
          return buffers.map((buffer) => ({
            image_url: {
              url: `data:image/png;base64,${encodeImageToBase64(buffer)}`,
            },
            type: "image_url" as const,
          }));
        })
      );
      return nestedImages.flat();
    };

    if (Array.isArray(input)) {
      return processImages(input);
    }

    if (typeof input === "string") {
      return [{ text: input, type: "text" }];
    }

    const { imagePaths, text } = input;
    const images = await processImages(imagePaths);
    return [...images, { text, type: "text" }];
  }

  private async handleOCR({
    buffers,
    maintainFormat,
    priorPage,
    prompt,
  }: CompletionArgs): Promise<CompletionResponse> {
    const systemPrompt = prompt || SYSTEM_PROMPT_BASE;

    // Default system message
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // If content has already been generated, add it to context.
    // This helps maintain the same format across pages
    if (maintainFormat && priorPage && priorPage.length) {
      messages.push({
        role: "system",
        content: CONSISTENCY_PROMPT(priorPage),
      });
    }

    // Add image to request
    const imageContents = buffers.map((buffer) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:image/png;base64,${encodeImageToBase64(buffer)}`,
      },
    }));
    messages.push({ role: "user", content: imageContents });

    const params = convertKeysToSnakeCase(this.llmParams ?? null);
    if (
      this.model.startsWith("o") ||
      this.model.startsWith("o3") ||
      this.model.startsWith("o4") ||
      this.model.startsWith("gpt-5")
    ) {
      if (params.max_tokens) {
        params.max_completion_tokens = params.max_tokens;
        delete params.max_tokens;
      }
    }

    try {
      const response = await this.client.chat.completions.create({
        messages,
        model: this.model,
        ...params,
      });

      const result: CompletionResponse = {
        content: response.choices[0].message.content || "",
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      };

      if (this.llmParams?.logprobs) {
        result["logprobs"] = convertKeysToCamelCase(
          response.choices[0].logprobs
        )?.content;
      }

      return result;
    } catch (err) {
      console.error("Error in OpenAI completion", err);
      throw err;
    }
  }

  private async handleExtraction({
    input,
    options,
    prompt,
    schema,
  }: ExtractionArgs): Promise<ExtractionResponse> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      if (prompt) {
        messages.push({ role: "system", content: prompt });
      }

      messages.push({
        role: "user",
        content: await this.createMessageContent({ input, options }),
      });

      const params = convertKeysToSnakeCase(this.llmParams ?? null);
      if (
        this.model.startsWith("o1") ||
        this.model.startsWith("o3") ||
        this.model.startsWith("gpt-5")
      ) {
        if (params.max_tokens) {
          params.max_completion_tokens = params.max_tokens;
          delete params.max_tokens;
        }
      }

      const response = await this.client.chat.completions.create({
        messages,
        model: this.model,
        response_format: {
          json_schema: { name: "extraction", schema },
          type: "json_schema",
        },
        ...params,
      });

      const result: ExtractionResponse = {
        extracted: response.choices[0].message.content
          ? JSON.parse(response.choices[0].message.content)
          : {},
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      };

      if (this.llmParams?.logprobs) {
        result["logprobs"] = convertKeysToCamelCase(
          response.choices[0].logprobs
        )?.content;
      }

      return result;
    } catch (err) {
      console.error("Error in OpenAI completion", err);
      throw err;
    }
  }
}
