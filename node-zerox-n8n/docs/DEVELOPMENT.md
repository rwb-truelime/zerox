# Development Guide for Zerox N8N Node

This guide provides comprehensive instructions for developing and extending the Zerox N8N node. Follow these steps to set up your development environment, understand the codebase, and contribute to the project.

## Development Environment Setup

### Prerequisites

- Node.js 16 or later
- npm 7 or later
- Git
- N8N (for testing)

### Initial Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/getomni-ai/zerox.git
   cd zerox
   ```

2. Navigate to the N8N node directory:

   ```bash
   cd node-zerox-n8n
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Build the node:
   ```bash
   npm run build
   ```

### Development Workflow

#### Local Development

1. Make changes to the code in the `nodes` or `credentials` directories
2. Build the node:
   ```bash
   npm run build
   ```
3. For continuous development, use the watch mode:
   ```bash
   npm run dev
   ```

#### Testing with N8N

1. Create a symbolic link in your N8N custom nodes directory:
   ```bash
   cd ~/.n8n/custom
   ln -s /path/to/zerox/node-zerox-n8n .
   ```
2. Restart your N8N instance to load the node

## Project Structure

```
node-zerox-n8n/
├── credentials/             # Credential definitions
│   └── ZeroxApi.credentials.ts
├── docs/                    # Documentation
│   ├── README.md
│   ├── DEVELOPMENT.md
│   └── PUBLISHING.md
├── nodes/                   # Node definitions
│   └── Zerox/
│       ├── Zerox.node.ts    # Main node implementation
│       └── zerox.svg        # Node icon
├── package.json             # Project configuration
└── tsconfig.json            # TypeScript configuration
```

## Code Architecture

### Credentials

The `ZeroxApi.credentials.ts` file defines the credential types needed for different model providers:

```typescript
export class ZeroxApi implements ICredentialType {
  name = "zeroxApi";
  displayName = "Zerox API";
  // Properties define the credential fields
  properties: INodeProperties[] = [
    // OpenAI, Azure, Google, AWS Bedrock credentials
  ];
}
```

### Node Implementation

The `Zerox.node.ts` file contains the main node implementation:

1. **Node Description**: Defines the UI elements, parameters, and options

   ```typescript
   description: INodeTypeDescription = {
     displayName: "Zerox",
     // Node properties, inputs, outputs, and parameters
   };
   ```

2. **Execute Method**: Handles the node execution logic
   ```typescript
   async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
     // Process input, call zerox library, return results
   }
   ```

## Adding New Features

### Adding a New Parameter

1. Identify the parameter type and where it should be added (main parameters, advanced options, etc.)
2. Add the parameter definition to the appropriate section in `Zerox.node.ts`:
   ```typescript
   {
     displayName: 'New Parameter',
     name: 'newParameter',
     type: 'string', // or appropriate type
     default: '',
     description: 'Description of the new parameter',
   }
   ```
3. Handle the parameter in the execute method:
   ```typescript
   const newParameter = this.getNodeParameter("newParameter", i, "") as string;
   // Add to zeroxArgs
   if (newParameter) zeroxArgs.newParameter = newParameter;
   ```

### Adding a New Operation

1. Add the new operation to the operations options:
   ```typescript
   {
     name: 'New Operation',
     value: 'newOperation',
     description: 'Description of the new operation',
     action: 'Performs a new operation',
   }
   ```
2. Add conditional logic in the execute method:
   ```typescript
   const operation = this.getNodeParameter("operation", i) as string;
   if (operation === "newOperation") {
     // Handle new operation
   }
   ```

## Testing

### Unit Testing

1. Create test files in a `__tests__` directory
2. Test individual functions and components:

   ```typescript
   import { Zerox } from "../nodes/Zerox/Zerox.node";

   describe("Zerox Node", () => {
     it("should properly format parameters", () => {
       // Test implementation
     });
   });
   ```

### Integration Testing

1. Test the node in an actual N8N workflow
2. Verify that all parameters work as expected
3. Test with different model providers and configurations

## Debugging

1. Enable N8N debug logs:
   ```bash
   export N8N_LOG_LEVEL=debug
   ```
2. Check the logs for errors and execution details
3. Use console.log statements in the execute method for specific debugging:
   ```typescript
   console.log("Zerox args:", zeroxArgs);
   ```

## Best Practices

1. **Type Safety**: Use TypeScript types for all parameters and return values
2. **Error Handling**: Properly catch and handle errors, providing meaningful messages
3. **Documentation**: Update documentation when adding new features
4. **Testing**: Write tests for new functionality
5. **Code Style**: Follow the existing code style and formatting
6. **Versioning**: Update the version number according to semantic versioning
