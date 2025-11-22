import { compareKeywords } from "./utils";
import { ModelOptions, ModelProvider } from "../src/types";
import { zerox } from "../src";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import pLimit from "p-limit";

dotenv.config({ path: path.join(__dirname, "../.env") });

interface TestInput {
  expectedKeywords: string[][];
  file: string;
}

interface TestConfig {
  name: string;
  model: ModelOptions;
  modelProvider: ModelProvider;
  credentials: any;
  llmParams?: any;
  googleOptions?: any;
}

const FILE_CONCURRENCY = 10;
const INPUT_DIR = path.join(__dirname, "../../shared/inputs");
const TEST_JSON_PATH = path.join(__dirname, "../../shared/test.json");
const BASE_OUTPUT_DIR = path.join(__dirname, "results");

const configs: TestConfig[] = [
  // {
  //   name: "openai",
  //   model: ModelOptions.OPENAI_GPT_4_1,
  //   modelProvider: ModelProvider.OPENAI,
  //   credentials: { apiKey: process.env.OPENAI_API_KEY || "" },
  // },
  // {
  //   name: "google",
  //   model: ModelOptions.GOOGLE_GEMINI_3_PRO_PREVIEW,
  //   modelProvider: ModelProvider.GOOGLE,
  //   credentials: { apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "" },
  // },
  // {
  //   name: "google-vertex-gemini-2.5-pro",
  //   model: ModelOptions.GOOGLE_GEMINI_2_5_PRO,
  //   modelProvider: ModelProvider.VERTEX,
  //   credentials: {
  //     serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT || "",
  //     location: process.env.GOOGLE_LOCATION || "global",
  //   },
  //   llmParams: {
  //     // Explicit defaults used in providerDefaultParams
  //     maxOutputTokens: 16000,
  //     temperature: 1,
  //     topP: 1,
  //     frequencyPenalty: 0,
  //     presencePenalty: 0,
  //   },
  // },
  {
    name: "google-vertex-gemini-3-pro-preview",
    model: ModelOptions.GOOGLE_GEMINI_3_PRO_PREVIEW,
    modelProvider: ModelProvider.VERTEX,
    credentials: {
      serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT || "",
      location: process.env.GOOGLE_LOCATION || "global",
    },
    llmParams: {
      maxOutputTokens: 16000,
      temperature: 1,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
    googleOptions: {
      gemini3: {
        thinkingLevel: "high",
        mediaResolution: "high",
      },
    },
  },
];

async function runTestsForConfig(config: TestConfig, testInputs: TestInput[]) {
  if (
    !config.credentials.apiKey &&
    (!config.credentials.serviceAccount || !config.credentials.location)
  ) {
    console.warn(`Skipping ${config.name}: Missing Credentials`);
    return;
  }

  console.log(`Starting tests for ${config.name} using ${config.model}...`);

  const runTimestamp = Date.now();
  const outputDir = path.join(
    BASE_OUTPUT_DIR,
    `test-run-${runTimestamp}-${config.name}`
  );
  const tempDir = path.join(outputDir, "temp");

  // Create the output directory
  fs.mkdirSync(outputDir, { recursive: true });

  const limit = pLimit(FILE_CONCURRENCY);

  const results = await Promise.all(
    testInputs.map((testInput) =>
      limit(async () => {
        const filePath = path.join(INPUT_DIR, testInput.file);

        // Check if the file exists
        if (!fs.existsSync(filePath)) {
          console.warn(`File not found: ${filePath}`);
          return null;
        }

        try {
          // Run OCR on the file
          const ocrResult = await zerox({
            cleanup: false,
            filePath,
            maintainFormat: false,
            model: config.model,
            modelProvider: config.modelProvider,
            credentials: config.credentials,
            llmParams: config.llmParams,
            googleOptions: config.googleOptions,
            outputDir,
            tempDir,
          });

          // Compare expected keywords with OCR output
          const keywordCounts = compareKeywords(
            ocrResult.pages,
            testInput.expectedKeywords
          );

          // Prepare the result
          return {
            file: testInput.file,
            keywordCounts,
            totalKeywords: testInput.expectedKeywords.flat().length,
          };
        } catch (error) {
          console.error(`Error processing ${testInput.file}:`, error);
          return null;
        }
      })
    )
  );

  // Filter out any null results
  const filteredResults = results.filter(
    (result): result is NonNullable<typeof result> => result !== null
  );

  const tableData = filteredResults.map((result) => {
    const totalFound =
      result.keywordCounts.reduce(
        (sum, page) => sum + page.keywordsFound.length,
        0
      ) ?? 0;
    const totalMissing =
      result.keywordCounts.reduce(
        (sum, page) => sum + page.keywordsMissing.length,
        0
      ) ?? 0;
    const totalKeywords = totalFound + totalMissing;
    const percentage =
      totalKeywords > 0
        ? ((totalFound / totalKeywords) * 100).toFixed(2) + "%"
        : "N/A";

    return {
      fileName: result.file,
      keywordsFound: totalFound,
      keywordsMissing: totalMissing,
      percentage,
    };
  });

  // Write the test results to output.json
  const outputFilePath = path.join(outputDir, "results.json");
  fs.writeFileSync(outputFilePath, JSON.stringify(tableData, null, 2));
  console.table(tableData);
  console.log(`Results for ${config.name} saved to ${outputFilePath}`);
}

async function main() {
  // Read the test inputs and expected keywords
  const testInputs: TestInput[] = JSON.parse(
    fs.readFileSync(TEST_JSON_PATH, "utf-8")
  );

  for (const config of configs) {
    await runTestsForConfig(config, testInputs);
  }
}

main().catch((error) => {
  console.error("An error occurred during the test run:", error);
});
