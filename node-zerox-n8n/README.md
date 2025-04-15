# Zerox N8N Node

This directory contains the N8N node implementation for the Zerox OCR & Document Extraction library. This node allows you to integrate Zerox's powerful document processing capabilities into your N8N workflows.

## Directory Structure

```
node-zerox-n8n/
├── credentials/             # Credential definitions
│   └── ZeroxApi.credentials.ts
├── docs/                    # Documentation
│   ├── README.md            # General usage documentation
│   ├── DEVELOPMENT.md       # Development guide
│   └── PUBLISHING.md        # Publishing instructions
├── nodes/                   # Node definitions
│   └── Zerox/
│       ├── Zerox.node.ts    # Main node implementation
│       └── zerox.svg        # Node icon
├── package.json             # Project configuration
└── tsconfig.json            # TypeScript configuration
```

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the node:

   ```bash
   npm run build
   ```

3. Link to your N8N installation:

   ```bash
   cd ~/.n8n/custom
   ln -s /path/to/zerox/node-zerox-n8n .
   ```

4. Restart your N8N instance

## Documentation

- [Usage Guide](./docs/README.md) - How to use the Zerox node in N8N
- [Development Guide](./docs/DEVELOPMENT.md) - How to develop and extend the node
- [Publishing Guide](./docs/PUBLISHING.md) - How to publish and distribute the node

## Features

- Process documents with OCR and extraction capabilities
- Support for multiple model providers (OpenAI, Azure, Google, AWS Bedrock)
- Configurable extraction parameters
- Advanced options for fine-tuning the extraction process
- LLM parameter customization

## License

This project is licensed under the same license as the main Zerox repository.
