# Zerox N8N Node

This N8N node integrates the powerful Zerox OCR & Document Extraction library into your N8N workflows, allowing you to process documents with state-of-the-art vision models.

## Features

- Process documents with OCR and extraction capabilities
- Support for multiple model providers (OpenAI, Azure, Google, AWS Bedrock)
- Configurable extraction parameters
- Advanced options for fine-tuning the extraction process
- LLM parameter customization

## Requirements

- N8N version 1.0.0 or later
- Node.js version 16 or later
- Zerox library dependencies (including Ghostscript)

## Installation

1. Install the node package in your N8N installation:

   ```
   npm install n8n-nodes-zerox
   ```

2. Restart your N8N instance

## Configuration

### Credentials

The Zerox node requires API credentials based on the model provider you choose:

- **OpenAI**: API Key
- **Azure**: API Key and Endpoint
- **Google**: API Key
- **AWS Bedrock**: Access Key ID, Secret Access Key, Region, and optionally Session Token

### Node Parameters

#### Basic Parameters

- **File Path**: Path to the document file to process
- **Model Provider**: Select from OpenAI, Azure, Google, or AWS Bedrock
- **Model**: Choose from various models like GPT-4o, Claude, Gemini, etc.
- **Custom Model**: Specify a custom model identifier if needed
- **Error Mode**: Choose how to handle errors (Throw or Ignore)
- **Output Directory**: Directory to save output files (optional)
- **Temporary Directory**: Directory for temporary files (optional)

#### Advanced Options

- **Cleanup**: Whether to clean up temporary files
- **Concurrency**: Number of concurrent operations
- **Correct Orientation**: Whether to correct document orientation
- **Direct Image Extraction**: Extract directly from images
- **Enable Hybrid Extraction**: Use hybrid extraction methods
- **Extract Only**: Only extract without OCR
- **Extract Per Page**: Specify pages to extract
- **Image Density**: DPI for image processing
- **Image Height**: Height of images in pixels
- **Maintain Format**: Whether to maintain document format
- **Max Image Size**: Maximum image size in MB
- **Max Retries**: Maximum number of retry attempts
- **Max Tesseract Workers**: Number of Tesseract workers
- **Pages To Convert As Images**: Pages to convert as images
- **Prompt**: Custom prompt for the model
- **Schema**: JSON schema for extraction
- **Trim Edges**: Whether to trim document edges

#### Extraction Options

- **Extraction Model Provider**: Provider for extraction model
- **Extraction Model**: Model for extraction
- **Custom Extraction Model**: Custom model for extraction
- **Extraction Prompt**: Custom prompt for extraction

#### LLM Parameters

- **Temperature**: Controls randomness (0-1)
- **Top P**: Controls diversity via nucleus sampling
- **Frequency Penalty**: Reduces repetition of token sequences
- **Presence Penalty**: Reduces repetition of topics
- **Max Tokens**: Maximum tokens to generate
- **Log Probabilities**: Whether to return log probabilities

## Usage Examples

### Basic Document Processing

1. Add the Zerox node to your workflow
2. Configure the file path to your document
3. Select your preferred model provider and model
4. Connect to subsequent nodes to process the extraction results

### Advanced Document Extraction with Schema

1. Add the Zerox node to your workflow
2. Configure the file path to your document
3. Select your preferred model provider and model
4. In Advanced Options, add a JSON schema to guide the extraction
5. Connect to subsequent nodes to process the structured extraction results

## Troubleshooting

- **Error: "Failed to load document"**: Ensure the file path is correct and the file is accessible
- **Error: "Invalid credentials"**: Verify your API keys and credentials
- **Error: "Model not available"**: Check if the selected model is available for your account
- **Performance issues**: Adjust concurrency and worker settings based on your system resources
