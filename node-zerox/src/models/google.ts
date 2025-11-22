import { convertKeysToSnakeCase } from "../utils/common";
import { cleanupImage, encodeImageToBase64 } from "../utils/image";
import {
  CompletionArgs,
  CompletionResponse,
  ExtractionArgs,
  ExtractionResponse,
  GoogleCredentials,
  GoogleLLMParams,
  GoogleModelOptions,
  MessageContentArgs,
  ModelInterface,
  OperationMode,
  VertexCredentials,
} from "../types";
import { CONSISTENCY_PROMPT, SYSTEM_PROMPT_BASE } from "../constants";
import { GoogleGenAI } from "@google/genai";
import fs from "fs-extra";

const GEMINI_3_THINKING_LEVEL_MAP = {
  low: "THINKING_LEVEL_LOW",
  high: "THINKING_LEVEL_HIGH",
} as const;

const GEMINI_3_MEDIA_RESOLUTION_MAP = {
  low: "MEDIA_RESOLUTION_LOW",
  medium: "MEDIA_RESOLUTION_MEDIUM",
  high: "MEDIA_RESOLUTION_HIGH",
} as const;

export default class GoogleModel implements ModelInterface {
  private client: GoogleGenAI;
  private model: string;
  private llmParams?: Partial<GoogleLLMParams>;
  private googleOptions?: GoogleModelOptions;
  private isVertexDeployment: boolean;
  private hasLoggedVertexThinkingWarning: boolean;

  constructor(
    credentials: GoogleCredentials | VertexCredentials,
    model: string,
    llmParams?: Partial<GoogleLLMParams>,
    googleOptions?: GoogleModelOptions,
    client?: GoogleGenAI
  ) {
    const options: any = {
      httpOptions: { timeout: 300000 },
    };
    this.isVertexDeployment = false;
    this.hasLoggedVertexThinkingWarning = false;

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
      this.isVertexDeployment = true;
    } else {
      options.apiKey = (credentials as GoogleCredentials).apiKey;
    }

    this.client = client ?? new GoogleGenAI(options);
    this.model = model;
    this.llmParams = llmParams;
    this.googleOptions = googleOptions;
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
          return buffers.map((buffer) => ({
            inlineData: {
              data: encodeImageToBase64(buffer),
              mimeType: "image/png",
            },
          }));
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
    const imageContents = buffers.map((buffer) => ({
      inlineData: {
        data: encodeImageToBase64(buffer),
        mimeType: "image/png",
      },
    }));
    promptParts.push(...imageContents);

    // If content has already been generated, add it to context
    if (maintainFormat && priorPage && priorPage.length) {
      promptParts.push({ text: CONSISTENCY_PROMPT(priorPage) });
    }

    const systemInstruction = prompt || SYSTEM_PROMPT_BASE;

    const config = this.applyGemini3Overrides({
      ...convertKeysToSnakeCase(this.llmParams ?? null),
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
    });

    const requestPayload = {
      config,
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

    const config = this.applyGemini3Overrides({
      ...convertKeysToSnakeCase(this.llmParams ?? null),
      responseMimeType: "application/json",
      responseSchema: schema,
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
    });

    const requestPayload = {
      config,
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

  private isGemini3Model(): boolean {
    return typeof this.model === "string" && this.model.startsWith("gemini-3-");
  }

  private applyGemini3Overrides(
    config: Record<string, unknown>
  ): Record<string, unknown> {
    if (!this.isGemini3Model()) {
      return config;
    }

    const gemini3Options = this.googleOptions?.gemini3;
    if (!gemini3Options) {
      return config;
    }

    const enrichedConfig: Record<string, unknown> = { ...config };

    if (gemini3Options.thinkingLevel) {
      if (this.isVertexDeployment) {
        if (!this.hasLoggedVertexThinkingWarning) {
          console.warn(
            "Gemini 3 thinkingLevel is not yet supported on Vertex AI deployments; skipping option."
          );
          this.hasLoggedVertexThinkingWarning = true;
        }
      } else {
        const mappedLevel =
          GEMINI_3_THINKING_LEVEL_MAP[gemini3Options.thinkingLevel];
        if (!mappedLevel) {
          throw new Error(
            `Unsupported Gemini 3 thinking level: ${gemini3Options.thinkingLevel}`
          );
        }
        const currentConfig = (enrichedConfig as Record<string, any>)
          .thinkingConfig;
        (enrichedConfig as Record<string, any>).thinkingConfig = {
          ...(currentConfig ?? {}),
          thinkingLevel: mappedLevel,
        };
      }
    }

    if (gemini3Options.mediaResolution) {
      const mappedResolution =
        GEMINI_3_MEDIA_RESOLUTION_MAP[gemini3Options.mediaResolution];
      if (!mappedResolution) {
        throw new Error(
          `Unsupported Gemini 3 media resolution: ${gemini3Options.mediaResolution}`
        );
      }
      (enrichedConfig as Record<string, any>).mediaResolution =
        mappedResolution;
    }

    return enrichedConfig;
  }
}
