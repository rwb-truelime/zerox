import {
  INodeType,
  INodeTypeDescription,
  IExecuteFunctions,
  INodeExecutionData,
  IDataObject,
  NodeOperationError,
} from "n8n-workflow";
import { zerox } from "zerox-truelime";
import {
  ZeroxArgs,
  ModelCredentials,
  ErrorMode as ZeroxErrorMode,
  ModelProvider as ZeroxModelProvider,
} from "zerox-truelime";

export class Zerox implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Truelime Docs",
    name: "truelime-docs",
    icon: "file:truelime-zwart.png",
    // Use the themed icon structure
    // iconUrl: {
    //     light: "https://truelimeaiplatformpublic.blob.core.windows.net/prd/truelime-zwart.png",
    //     // Assuming the same icon works for dark theme, or replace with a specific dark theme icon URL if available
    //     dark: "https://truelimeaiplatformpublic.blob.core.windows.net/prd/truelime-zwart.png"
    // },
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: "OCR & Document Extraction using vision models",
    defaults: {
      name: "Truelime Docs",
    },
    // Use expression string format for inputs/outputs
    inputs: '={{["main"]}}',
    outputs: '={{["main"]}}',
    credentials: [
      {
        name: "zeroxApi",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "Process Document",
            value: "processDocument",
            description: "Process a document with OCR and extraction",
            action: "Process a document with OCR and extraction",
          },
        ],
        default: "processDocument",
      },
      {
        displayName: "File Path",
        name: "filePath",
        type: "string",
        default: "",
        required: true,
        description: "Path to the file to process",
      },
      {
        displayName: "Model Provider",
        name: "modelProvider",
        type: "options",
        options: [
          {
            name: "OpenAI",
            value: "OPENAI",
          },
          {
            name: "Azure",
            value: "AZURE",
          },
          {
            name: "Google",
            value: "GOOGLE",
          },
          {
            name: "AWS Bedrock",
            value: "BEDROCK",
          },
        ],
        default: "OPENAI",
        description: "The model provider to use",
      },
      {
        displayName: "Model",
        name: "model",
        type: "options",
        options: [
          {
            name: "GPT-4o",
            value: "gpt-4o",
          },
          {
            name: "GPT-4o Mini",
            value: "gpt-4o-mini",
          },
          {
            name: "Claude 3 Haiku (2024-03)",
            value: "anthropic.claude-3-haiku-20240307-v1:0",
          },
          {
            name: "Claude 3 Haiku (2024-10)",
            value: "anthropic.claude-3-5-haiku-20241022-v1:0",
          },
          {
            name: "Claude 3 Sonnet (2024-02)",
            value: "anthropic.claude-3-sonnet-20240229-v1:0",
          },
          {
            name: "Claude 3 Sonnet (2024-06)",
            value: "anthropic.claude-3-5-sonnet-20240620-v1:0",
          },
          {
            name: "Claude 3 Sonnet (2024-10)",
            value: "anthropic.claude-3-5-sonnet-20241022-v2:0",
          },
          {
            name: "Claude 3 Opus (2024-02)",
            value: "anthropic.claude-3-opus-20240229-v1:0",
          },
          {
            name: "Gemini 1.5 Flash",
            value: "gemini-1.5-flash",
          },
          {
            name: "Gemini 1.5 Flash 8B",
            value: "gemini-1.5-flash-8b",
          },
          {
            name: "Gemini 1.5 Pro",
            value: "gemini-1.5-pro",
          },
          {
            name: "Gemini 2.0 Flash",
            value: "gemini-2.0-flash-001",
          },
          {
            name: "Gemini 2.0 Flash Lite",
            value: "gemini-2.0-flash-lite-preview-02-05",
          },
        ],
        default: "gpt-4o",
        description: "The model to use",
      },
      {
        displayName: "Custom Model",
        name: "customModel",
        type: "string",
        default: "",
        description:
          "Custom model identifier (if not using a predefined model)",
      },
      {
        displayName: "Error Mode",
        name: "errorMode",
        type: "options",
        options: [
          {
            name: "Throw",
            value: "THROW",
          },
          {
            name: "Ignore",
            value: "IGNORE",
          },
        ],
        default: "THROW",
        description: "How to handle errors",
      },
      {
        displayName: "Output Directory",
        name: "outputDir",
        type: "string",
        default: "",
        description: "Directory to save output files (optional)",
      },
      {
        displayName: "Temporary Directory",
        name: "tempDir",
        type: "string",
        default: "",
        description: "Directory to save temporary files (optional)",
      },
      {
        displayName: "Advanced Options",
        name: "advancedOptions",
        type: "collection",
        placeholder: "Add Option",
        default: {},
        options: [
          {
            displayName: "Cleanup",
            name: "cleanup",
            type: "boolean",
            default: true,
            description: "Whether to clean up temporary files after processing",
          },
          {
            displayName: "Concurrency",
            name: "concurrency",
            type: "number",
            default: 10,
            description: "Number of concurrent operations",
          },
          {
            displayName: "Correct Orientation",
            name: "correctOrientation",
            type: "boolean",
            default: true,
            description: "Whether to correct the orientation of the document",
          },
          {
            displayName: "Direct Image Extraction",
            name: "directImageExtraction",
            type: "boolean",
            default: false,
            description: "Whether to extract directly from images",
          },
          {
            displayName: "Enable Hybrid Extraction",
            name: "enableHybridExtraction",
            type: "boolean",
            default: false,
            description: "Whether to enable hybrid extraction",
          },
          {
            displayName: "Extract Only",
            name: "extractOnly",
            type: "boolean",
            default: false,
            description: "Whether to only extract without OCR",
          },
          {
            displayName: "Extract Per Page",
            name: "extractPerPage",
            type: "string",
            default: "",
            description: "Comma-separated list of pages to extract",
          },
          {
            displayName: "Image Density",
            name: "imageDensity",
            type: "number",
            default: 300,
            description: "Density of the image in DPI",
          },
          {
            displayName: "Image Height",
            name: "imageHeight",
            type: "number",
            default: 1500,
            description: "Height of the image in pixels",
          },
          {
            displayName: "Maintain Format",
            name: "maintainFormat",
            type: "boolean",
            default: false,
            description: "Whether to maintain the format of the document",
          },
          {
            displayName: "Max Image Size",
            name: "maxImageSize",
            type: "number",
            default: 15,
            description: "Maximum size of the image in MB",
          },
          {
            displayName: "Max Retries",
            name: "maxRetries",
            type: "number",
            default: 1,
            description: "Maximum number of retries",
          },
          {
            displayName: "Max Tesseract Workers",
            name: "maxTesseractWorkers",
            type: "number",
            default: -1,
            description: "Maximum number of Tesseract workers (-1 for auto)",
          },
          {
            displayName: "Pages To Convert As Images",
            name: "pagesToConvertAsImages",
            type: "string",
            default: "",
            description: "Comma-separated list of pages to convert as images",
          },
          {
            displayName: "Prompt",
            name: "prompt",
            type: "string",
            default: "",
            description: "Custom prompt for the model",
          },
          {
            displayName: "Schema",
            name: "schema",
            type: "json",
            default: "{}",
            description: "JSON schema for extraction",
          },
          {
            displayName: "Trim Edges",
            name: "trimEdges",
            type: "boolean",
            default: true,
            description: "Whether to trim the edges of the document",
          },
        ],
      },
      {
        displayName: "Extraction Options",
        name: "extractionOptions",
        type: "collection",
        placeholder: "Add Extraction Option",
        default: {},
        options: [
          {
            displayName: "Extraction Model Provider",
            name: "extractionModelProvider",
            type: "options",
            options: [
              {
                name: "OpenAI",
                value: "OPENAI",
              },
              {
                name: "Azure",
                value: "AZURE",
              },
              {
                name: "Google",
                value: "GOOGLE",
              },
              {
                name: "AWS Bedrock",
                value: "BEDROCK",
              },
            ],
            default: "OPENAI",
            description: "The model provider to use for extraction",
          },
          {
            displayName: "Extraction Model",
            name: "extractionModel",
            type: "options",
            options: [
              {
                name: "GPT-4o",
                value: "gpt-4o",
              },
              {
                name: "GPT-4o Mini",
                value: "gpt-4o-mini",
              },
              {
                name: "Claude 3 Haiku (2024-03)",
                value: "anthropic.claude-3-haiku-20240307-v1:0",
              },
              {
                name: "Claude 3 Haiku (2024-10)",
                value: "anthropic.claude-3-5-haiku-20241022-v1:0",
              },
              {
                name: "Claude 3 Sonnet (2024-02)",
                value: "anthropic.claude-3-sonnet-20240229-v1:0",
              },
              {
                name: "Claude 3 Sonnet (2024-06)",
                value: "anthropic.claude-3-5-sonnet-20240620-v1:0",
              },
              {
                name: "Claude 3 Sonnet (2024-10)",
                value: "anthropic.claude-3-5-sonnet-20241022-v2:0",
              },
              {
                name: "Claude 3 Opus (2024-02)",
                value: "anthropic.claude-3-opus-20240229-v1:0",
              },
              {
                name: "Gemini 1.5 Flash",
                value: "gemini-1.5-flash",
              },
              {
                name: "Gemini 1.5 Flash 8B",
                value: "gemini-1.5-flash-8b",
              },
              {
                name: "Gemini 1.5 Pro",
                value: "gemini-1.5-pro",
              },
              {
                name: "Gemini 2.0 Flash",
                value: "gemini-2.0-flash-001",
              },
              {
                name: "Gemini 2.0 Flash Lite",
                value: "gemini-2.0-flash-lite-preview-02-05",
              },
            ],
            default: "gpt-4o",
            description: "The model to use for extraction",
          },
          {
            displayName: "Custom Extraction Model",
            name: "customExtractionModel",
            type: "string",
            default: "",
            description:
              "Custom model identifier for extraction (if not using a predefined model)",
          },
          {
            displayName: "Extraction Prompt",
            name: "extractionPrompt",
            type: "string",
            default: "",
            description: "Custom prompt for extraction",
          },
        ],
      },
      {
        displayName: "LLM Parameters",
        name: "llmParameters",
        type: "collection",
        placeholder: "Add LLM Parameter",
        default: {},
        options: [
          {
            displayName: "Temperature",
            name: "temperature",
            type: "number",
            default: 0,
            description: "Temperature for the model",
          },
          {
            displayName: "Top P",
            name: "topP",
            type: "number",
            default: 1,
            description: "Top P for the model",
          },
          {
            displayName: "Frequency Penalty",
            name: "frequencyPenalty",
            type: "number",
            default: 0,
            description: "Frequency penalty for the model",
          },
          {
            displayName: "Presence Penalty",
            name: "presencePenalty",
            type: "number",
            default: 0,
            description: "Presence penalty for the model",
          },
          {
            displayName: "Max Tokens",
            name: "maxTokens",
            type: "number",
            default: 4096,
            description: "Maximum number of tokens for the model",
          },
          {
            displayName: "Log Probabilities",
            name: "logprobs",
            type: "boolean",
            default: false,
            description: "Whether to return log probabilities",
          },
        ],
      },
      {
        displayName: "Extraction LLM Parameters",
        name: "extractionLlmParameters",
        type: "collection",
        placeholder: "Add Extraction LLM Parameter",
        default: {},
        options: [
          {
            displayName: "Temperature",
            name: "temperature",
            type: "number",
            default: 0,
            description: "Temperature for the extraction model",
          },
          {
            displayName: "Top P",
            name: "topP",
            type: "number",
            default: 1,
            description: "Top P for the extraction model",
          },
          {
            displayName: "Frequency Penalty",
            name: "frequencyPenalty",
            type: "number",
            default: 0,
            description: "Frequency penalty for the extraction model",
          },
          {
            displayName: "Presence Penalty",
            name: "presencePenalty",
            type: "number",
            default: 0,
            description: "Presence penalty for the extraction model",
          },
          {
            displayName: "Max Tokens",
            name: "maxTokens",
            type: "number",
            default: 4096,
            description: "Maximum number of tokens for the extraction model",
          },
          {
            displayName: "Log Probabilities",
            name: "logprobs",
            type: "boolean",
            default: false,
            description: "Whether to return log probabilities for extraction",
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        // Get parameters
        const filePath = this.getNodeParameter("filePath", i) as string;
        const modelProvider = this.getNodeParameter(
          "modelProvider",
          i,
        ) as ZeroxModelProvider;
        const model = this.getNodeParameter("model", i) as string;
        const customModel = this.getNodeParameter(
          "customModel",
          i,
          "",
        ) as string;
        // Cast errorMode to the imported enum type
        const errorMode = this.getNodeParameter(
          "errorMode",
          i,
        ) as ZeroxErrorMode;
        const outputDir = this.getNodeParameter("outputDir", i, "") as string;
        const tempDir = this.getNodeParameter("tempDir", i, "") as string;

        // Get advanced options
        const advancedOptions = this.getNodeParameter(
          "advancedOptions",
          i,
          {},
        ) as IDataObject;
        const extractionOptions = this.getNodeParameter(
          "extractionOptions",
          i,
          {},
        ) as IDataObject;
        const llmParameters = this.getNodeParameter(
          "llmParameters",
          i,
          {},
        ) as IDataObject;
        const extractionLlmParameters = this.getNodeParameter(
          "extractionLlmParameters",
          i,
          {},
        ) as IDataObject;

        // Get credentials
        const credentials = (await this.getCredentials(
          "zeroxApi",
        )) as IDataObject;

        // Prepare credentials object based on model provider
        // Use IDataObject for now, cast later when assigning to zeroxArgs
        const modelCredentials: IDataObject = {};

        if (modelProvider === ZeroxModelProvider.OPENAI) {
          modelCredentials.apiKey = credentials.openaiApiKey as string;
        } else if (modelProvider === ZeroxModelProvider.AZURE) {
          modelCredentials.apiKey = credentials.azureApiKey as string;
          modelCredentials.endpoint = credentials.azureEndpoint as string;
        } else if (modelProvider === ZeroxModelProvider.GOOGLE) {
          modelCredentials.apiKey = credentials.googleApiKey as string;
        } else if (modelProvider === ZeroxModelProvider.BEDROCK) {
          modelCredentials.accessKeyId =
            credentials.bedrockAccessKeyId as string;
          modelCredentials.secretAccessKey =
            credentials.bedrockSecretAccessKey as string;
          modelCredentials.region = credentials.bedrockRegion as string;
          if (credentials.bedrockSessionToken) {
            modelCredentials.sessionToken =
              credentials.bedrockSessionToken as string;
          }
        }

        // Prepare extraction credentials if different from main credentials
        // Use IDataObject for now, cast later when assigning to zeroxArgs
        let extractionCredentials: IDataObject | undefined;
        if (extractionOptions.extractionModelProvider) {
          extractionCredentials = {};
          const extractionModelProvider =
            extractionOptions.extractionModelProvider as ZeroxModelProvider; // Use imported enum

          if (extractionModelProvider === ZeroxModelProvider.OPENAI) {
            extractionCredentials.apiKey = credentials.openaiApiKey as string;
          } else if (extractionModelProvider === ZeroxModelProvider.AZURE) {
            extractionCredentials.apiKey = credentials.azureApiKey as string;
            extractionCredentials.endpoint =
              credentials.azureEndpoint as string;
          } else if (extractionModelProvider === ZeroxModelProvider.GOOGLE) {
            extractionCredentials.apiKey = credentials.googleApiKey as string;
          } else if (extractionModelProvider === ZeroxModelProvider.BEDROCK) {
            extractionCredentials.accessKeyId =
              credentials.bedrockAccessKeyId as string;
            extractionCredentials.secretAccessKey =
              credentials.bedrockSecretAccessKey as string;
            extractionCredentials.region = credentials.bedrockRegion as string;
            if (credentials.bedrockSessionToken) {
              extractionCredentials.sessionToken =
                credentials.bedrockSessionToken as string;
            }
          }
        }

        // Prepare LLM parameters
        const llmParams: IDataObject = {};
        if (llmParameters.temperature !== undefined)
          llmParams.temperature = llmParameters.temperature as number;
        if (llmParameters.topP !== undefined)
          llmParams.topP = llmParameters.topP as number;
        if (llmParameters.frequencyPenalty !== undefined)
          llmParams.frequencyPenalty = llmParameters.frequencyPenalty as number;
        if (llmParameters.presencePenalty !== undefined)
          llmParams.presencePenalty = llmParameters.presencePenalty as number;
        if (llmParameters.maxTokens !== undefined)
          llmParams.maxTokens = llmParameters.maxTokens as number;
        if (llmParameters.logprobs !== undefined)
          llmParams.logprobs = llmParameters.logprobs as boolean;

        // Prepare extraction LLM parameters
        const extractionLlmParams: IDataObject = {};
        if (extractionLlmParameters.temperature !== undefined)
          extractionLlmParams.temperature =
            extractionLlmParameters.temperature as number;
        if (extractionLlmParameters.topP !== undefined)
          extractionLlmParams.topP = extractionLlmParameters.topP as number;
        if (extractionLlmParameters.frequencyPenalty !== undefined)
          extractionLlmParams.frequencyPenalty =
            extractionLlmParameters.frequencyPenalty as number;
        if (extractionLlmParameters.presencePenalty !== undefined)
          extractionLlmParams.presencePenalty =
            extractionLlmParameters.presencePenalty as number;
        if (extractionLlmParameters.maxTokens !== undefined)
          extractionLlmParams.maxTokens =
            extractionLlmParameters.maxTokens as number;
        if (extractionLlmParameters.logprobs !== undefined)
          extractionLlmParams.logprobs =
            extractionLlmParameters.logprobs as boolean;

        // Process pages to convert as images
        let pagesToConvertAsImages: number[] | number | undefined;
        if (advancedOptions.pagesToConvertAsImages) {
          const pagesStr = advancedOptions.pagesToConvertAsImages as string;
          if (pagesStr && pagesStr.includes(",")) {
            pagesToConvertAsImages = pagesStr
              .split(",")
              .map((p) => parseInt(p.trim(), 10))
              .filter((p) => !isNaN(p));
          } else if (pagesStr) {
            const pageNum = parseInt(pagesStr.trim(), 10);
            if (!isNaN(pageNum)) {
              pagesToConvertAsImages = pageNum;
            }
          }
        }
        // Handle default value from zerox if string is empty
        if (
          pagesToConvertAsImages === undefined &&
          advancedOptions.pagesToConvertAsImages === ""
        ) {
          // Let zerox handle its internal default (-1) by not setting the property
        } else if (
          pagesToConvertAsImages === undefined &&
          !advancedOptions.pagesToConvertAsImages
        ) {
          // Let zerox handle its internal default (-1) by not setting the property
        }

        // Process extract per page
        let extractPerPage: string[] | undefined;
        if (advancedOptions.extractPerPage) {
          extractPerPage = (advancedOptions.extractPerPage as string)
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
        }

        // Parse schema if provided
        let schema: Record<string, unknown> | undefined;
        if (advancedOptions.schema) {
          try {
            const schemaParam = advancedOptions.schema;
            schema =
              typeof schemaParam === "string"
                ? JSON.parse(schemaParam)
                : (schemaParam as Record<string, unknown>);
          } catch (error) {
            throw new NodeOperationError(
              this.getNode(),
              `Invalid JSON schema: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Prepare zerox arguments object using the imported ZeroxArgs type
        const zeroxArgs: ZeroxArgs = {
          filePath,
          // Cast via unknown first to satisfy TypeScript
          credentials: modelCredentials as unknown as ModelCredentials,
          model: customModel || model,
          modelProvider,
          errorMode: errorMode, // Use the correctly typed enum value
        };

        // Add optional parameters, checking against undefined where necessary
        if (outputDir) zeroxArgs.outputDir = outputDir;
        if (tempDir) zeroxArgs.tempDir = tempDir;
        if (advancedOptions.cleanup !== undefined)
          zeroxArgs.cleanup = advancedOptions.cleanup as boolean;
        if (advancedOptions.concurrency !== undefined)
          zeroxArgs.concurrency = advancedOptions.concurrency as number;
        if (advancedOptions.correctOrientation !== undefined)
          zeroxArgs.correctOrientation =
            advancedOptions.correctOrientation as boolean;
        if (advancedOptions.directImageExtraction !== undefined)
          zeroxArgs.directImageExtraction =
            advancedOptions.directImageExtraction as boolean;
        if (advancedOptions.enableHybridExtraction !== undefined)
          zeroxArgs.enableHybridExtraction =
            advancedOptions.enableHybridExtraction as boolean;
        if (advancedOptions.extractOnly !== undefined)
          zeroxArgs.extractOnly = advancedOptions.extractOnly as boolean;
        if (extractPerPage && extractPerPage.length > 0)
          zeroxArgs.extractPerPage = extractPerPage;
        if (advancedOptions.imageDensity !== undefined)
          zeroxArgs.imageDensity = advancedOptions.imageDensity as number;
        if (advancedOptions.imageHeight !== undefined)
          zeroxArgs.imageHeight = advancedOptions.imageHeight as number;
        if (advancedOptions.maintainFormat !== undefined)
          zeroxArgs.maintainFormat = advancedOptions.maintainFormat as boolean;
        if (advancedOptions.maxImageSize !== undefined)
          zeroxArgs.maxImageSize = advancedOptions.maxImageSize as number;
        if (advancedOptions.maxRetries !== undefined)
          zeroxArgs.maxRetries = advancedOptions.maxRetries as number;
        if (advancedOptions.maxTesseractWorkers !== undefined)
          zeroxArgs.maxTesseractWorkers =
            advancedOptions.maxTesseractWorkers as number;
        // Only add pagesToConvertAsImages if it was successfully parsed
        if (pagesToConvertAsImages !== undefined)
          zeroxArgs.pagesToConvertAsImages = pagesToConvertAsImages;
        if (advancedOptions.prompt)
          zeroxArgs.prompt = advancedOptions.prompt as string;
        if (schema) zeroxArgs.schema = schema;
        if (advancedOptions.trimEdges !== undefined)
          zeroxArgs.trimEdges = advancedOptions.trimEdges as boolean;

        // Add extraction options
        if (extractionOptions.extractionModelProvider)
          zeroxArgs.extractionModelProvider =
            extractionOptions.extractionModelProvider as ZeroxModelProvider; // Use imported enum
        if (
          extractionOptions.extractionModel ||
          extractionOptions.customExtractionModel
        ) {
          zeroxArgs.extractionModel =
            (extractionOptions.customExtractionModel as string) ||
            (extractionOptions.extractionModel as string);
        }
        if (extractionOptions.extractionPrompt)
          zeroxArgs.extractionPrompt =
            extractionOptions.extractionPrompt as string;
        if (extractionCredentials)
          // Cast via unknown first to satisfy TypeScript
          zeroxArgs.extractionCredentials =
            extractionCredentials as unknown as ModelCredentials;

        // Add LLM parameters
        if (Object.keys(llmParams).length > 0) zeroxArgs.llmParams = llmParams;
        if (Object.keys(extractionLlmParams).length > 0)
          zeroxArgs.extractionLlmParams = extractionLlmParams;

        // Call zerox function
        const result = await zerox(zeroxArgs);

        // Return the result - Keep the cast for IDataObject compatibility
        const executionData = this.helpers.constructExecutionMetaData(
          this.helpers.returnJsonArray([result as unknown as IDataObject]),
          { itemData: { item: i } },
        );

        returnData.push(...executionData);
      } catch (error) {
        if (this.continueOnFail()) {
          const errorMessage =
            error instanceof Error ? error.message : JSON.stringify(error);
          const executionData = this.helpers.constructExecutionMetaData(
            this.helpers.returnJsonArray({ error: errorMessage }),
            { itemData: { item: i } },
          );
          returnData.push(...executionData);
          continue;
        }
        // If not continuing on fail, re-throw the error
        if (error instanceof NodeOperationError) {
          throw error;
        } else {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new NodeOperationError(this.getNode(), errorMessage, {
            itemIndex: i,
          });
        }
      }
    }

    return [returnData];
  }
}
