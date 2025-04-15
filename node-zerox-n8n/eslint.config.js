import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import n8nPlugin from "eslint-plugin-n8n-nodes-base";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

// Define the configurations from the n8n plugin using the new flat format
const n8nNodesConfig = n8nPlugin.configs["flat/nodes"];
const n8nCredentialsConfig = n8nPlugin.configs["flat/credentials"];
// Get the community rules directly, avoiding spreading the whole config object
const n8nCommunityRules = n8nPlugin.configs["flat/community"]?.rules ?? {};

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "dist/",
      "node_modules/",
      "*.config.js", // Ignore ESLint config itself
      "*.config.mjs",
      "*.config.cjs",
      "docs/", // Ignore documentation folder
      "*.md", // Ignore markdown files
    ],
  },

  // Base ESLint recommended rules (applies broadly)
  eslint.configs.recommended,

  // TypeScript files configuration
  {
    files: ["**/*.ts"], // Apply TS rules and parser only to .ts files
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json", // Ensure this path is correct
        tsconfigRootDir: import.meta.dirname, // Helps ESLint find tsconfig relative to eslint.config.js
      },
    },
    plugins: { "n8n-nodes-base": n8nPlugin }, // Ensure plugin is available for TS files too if needed
    rules: {
      // Add any general TS overrides here if needed
    },
  },

  // N8N Node rules (applied only to .node.ts files)
  {
    files: ["nodes/**/*.node.ts"],
    ...n8nNodesConfig, // Spread the config object
    plugins: { "n8n-nodes-base": n8nPlugin },
    rules: {
      // Add specific overrides for node rules if needed
    },
  },

  // N8N Credential rules (applied only to .credentials.ts files)
  {
    files: ["credentials/**/*.credentials.ts"],
    ...n8nCredentialsConfig, // Spread the config object
    plugins: { "n8n-nodes-base": n8nPlugin },
    rules: {
      // Add specific overrides for credential rules if needed
    },
  },

  // N8N Community rules (applied only to package.json)
  {
    files: ["package.json"],
    // DO NOT define languageOptions/parser/parserOptions here for JSON
    plugins: { "n8n-nodes-base": n8nPlugin }, // PUT THE PLUGIN BACK HERE
    rules: {
      ...n8nCommunityRules, // Apply the community rules directly
      // Override specific rules as before
      "n8n-nodes-base/community-package-json-author-name-still-default": [
        "error",
        { authorName: "Omni AI" },
      ],
      "n8n-nodes-base/community-package-json-author-email-still-default": [
        "error",
        { authorEmail: "info@getomni.ai" },
      ],
      "n8n-nodes-base/community-package-json-repository-url-still-default":
        "off",
      "n8n-nodes-base/community-package-json-description-still-default": "off",
      "n8n-nodes-base/community-package-json-name-still-default": "off",
    },
  },

  // Prettier recommended config (must be last to override other style rules)
  eslintPluginPrettierRecommended,
);
