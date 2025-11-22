import {
  cleanupImage,
  convertKeysToSnakeCase,
  encodeImageToBase64,
} from "../utils";
import {
  CompletionArgs,
  CompletionResponse,
  ExtractionArgs,
  ExtractionResponse,
  GoogleCredentials,
  GoogleLLMParams,
  MessageContentArgs,
  ModelInterface,
  OperationMode,
  VertexCredentials,
} from "../types";
import { CONSISTENCY_PROMPT, SYSTEM_PROMPT_BASE } from "../constants";
import { GoogleGenAI, createPartFromBase64 } from "@google/genai";
import fs from "fs-extra";

export default class GoogleModel implements ModelInterface {
  private client: GoogleGenAI;
  private model: string;
  private llmParams?: Partial<GoogleLLMParams>;

  constructor(
    credentials: GoogleCredentials | VertexCredentials,
    model: string,
    llmParams?: Partial<GoogleLLMParams>
  ) {
    const options: any = {
      httpOptions: { timeout: 300000 },
    };

    if ("serviceAccount" in credentials) {
      let serviceAccount = credentials.serviceAccount;
      if (typeof serviceAccount === "string") {
        try {
          serviceAccount = JSON.parse(serviceAccount);
        } catch (e) {
          throw new Error("Invalid service account JSON string");
        }
      }

      const projectId = (serviceAccount as any).project_id;
      if (!projectId) {
        throw new Error("Service account JSON missing project_id");
      }

      options.project = projectId;
      options.location = (credentials as VertexCredentials).location;
      options.vertexai = true;
      options.googleAuthOptions = { credentials: serviceAccount };
    } else {
      options.apiKey = (credentials as GoogleCredentials).apiKey;
    }

    this.client = new GoogleGenAI(options);
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
  }: MessageContentArgs): Promise<any> {
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
          return buffers.map((buffer) =>
            createPartFromBase64(encodeImageToBase64(buffer), "image/png")
          );
        })
      );
      return nestedImages.flat();
    };

    if (Array.isArray(input)) {
      return processImages(input);
    }

    if (typeof input === "string") {
      return [{ text: input }];
    }

    const { imagePaths, text } = input;
    const images = await processImages(imagePaths);
    return [...images, { text }];
  }

  private async handleOCR({
    buffers,
    maintainFormat,
    priorPage,
    prompt,
  }: CompletionArgs): Promise<CompletionResponse> {
    // Insert the text prompt after the image contents array
    // https://ai.google.dev/gemini-api/docs/image-understanding?lang=node#technical-details-image

    // Build the prompt parts
    const promptParts: any = [];

    // Add image contents
    const imageContents = buffers.map((buffer) =>
      createPartFromBase64(encodeImageToBase64(buffer), "image/png")
    );
    promptParts.push(...imageContents);

    // If content has already been generated, add it to context
    if (maintainFormat && priorPage && priorPage.length) {
      promptParts.push({ text: CONSISTENCY_PROMPT(priorPage) });
    }

    const systemInstruction = prompt || SYSTEM_PROMPT_BASE;

    const requestPayload = {
      config: {
        ...convertKeysToSnakeCase(this.llmParams ?? null),
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
      },
      contents: promptParts,
      model: this.model,
    };

    const safeRequestPayload = {
      ...requestPayload,
      contents: (requestPayload.contents || []).map((part: any) => {
        if (part.inlineData || part.inline_data) {
          const { inlineData, inline_data, ...rest } = part;
          return {
            ...rest,
            inlineData: inlineData
              ? { ...inlineData, data: "<omitted>" }
              : undefined,
            inline_data: inline_data
              ? { ...inline_data, data: "<omitted>" }
              : undefined,
          };
        }
        return part;
      }),
    };

    try {
      const response = await this.client.models.generateContent(
        requestPayload
      );

      // Structured debug log for tests (filename is not available here)
      console.table([
        {
          context: "OCR",
          filename: "N/A",
          model: this.model,
          request: JSON.stringify(safeRequestPayload, null, 2),
          response: "<see raw API response>",
        },
      ]);

      return {
        content: response.text || "",
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      };
    } catch (err) {
      console.error("Error in Google completion", err);
      console.table([
        {
          context: "OCR",
          filename: "N/A",
          model: this.model,
          request: JSON.stringify(safeRequestPayload, null, 2),
          error: String(err),
        },
      ]);
      throw err;
    }
  }

  private async handleExtraction({
    input,
    options,
    prompt,
    schema,
  }: ExtractionArgs): Promise<ExtractionResponse> {
    // Build the prompt parts
    const promptParts: any = [];

    const parts = await this.createMessageContent({ input, options });
    promptParts.push(...parts);

    const systemInstruction = prompt || "Extract schema data";

    const requestPayload = {
      config: {
        ...convertKeysToSnakeCase(this.llmParams ?? null),
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
      },
      contents: promptParts,
      model: this.model,
    };

    const safeRequestPayload = {
      ...requestPayload,
      contents: (requestPayload.contents || []).map((part: any) => {
        if (part.inlineData || part.inline_data) {
          const { inlineData, inline_data, ...rest } = part;
          return {
            ...rest,
            inlineData: inlineData
              ? { ...inlineData, data: "<omitted>" }
              : undefined,
            inline_data: inline_data
              ? { ...inline_data, data: "<omitted>" }
              : undefined,
          };
        }
        return part;
      }),
    };

    try {
      const response = await this.client.models.generateContent(
        requestPayload
      );

      console.table([
        {
          context: "EXTRACTION",
          filename: "N/A",
          model: this.model,
          request: JSON.stringify(safeRequestPayload, null, 2),
          response: "<see raw API response>",
        },
      ]);

      return {
        extracted: response.text ? JSON.parse(response.text) : {},
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      };
    } catch (err) {
      console.error("Error in Google completion", err);
      console.table([
        {
          context: "EXTRACTION",
          filename: "N/A",
          model: this.model,
          request: JSON.stringify(safeRequestPayload, null, 2),
          error: String(err),
        },
      ]);
      throw err;
    }
  }
}
