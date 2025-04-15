import { ICredentialType, INodeProperties } from "n8n-workflow";

export class ZeroxApi implements ICredentialType {
  name = "zeroxApi";
  displayName = "Zerox API";
  documentationUrl = "https://github.com/getomni-ai/zerox";
  properties: INodeProperties[] = [
    // OpenAI credentials
    {
      displayName: "OpenAI API Key",
      name: "openaiApiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      description: "OpenAI API key for GPT models",
    },
    // Azure credentials
    {
      displayName: "Azure API Key",
      name: "azureApiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      description: "Azure API key for Azure OpenAI models",
    },
    {
      displayName: "Azure Endpoint",
      name: "azureEndpoint",
      type: "string",
      default: "",
      description: "Azure endpoint URL for Azure OpenAI models",
    },
    // Google credentials
    {
      displayName: "Google API Key",
      name: "googleApiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      description: "Google API key for Gemini models",
    },
    // AWS Bedrock credentials
    {
      displayName: "AWS Bedrock Access Key ID",
      name: "bedrockAccessKeyId",
      type: "string",
      default: "",
      description: "AWS access key ID for Bedrock models",
    },
    {
      displayName: "AWS Bedrock Secret Access Key",
      name: "bedrockSecretAccessKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      description: "AWS secret access key for Bedrock models",
    },
    {
      displayName: "AWS Bedrock Region",
      name: "bedrockRegion",
      type: "string",
      default: "us-east-1",
      description: "AWS region for Bedrock models",
    },
    {
      displayName: "AWS Bedrock Session Token (Optional)",
      name: "bedrockSessionToken",
      type: "string",
      typeOptions: {
        password: true,
      },
      default: "",
      description: "AWS session token for temporary credentials (optional)",
    },
  ];
}
