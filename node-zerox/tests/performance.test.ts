import dotenv from "dotenv";
dotenv.config();

import path from "path";
import { zerox } from "../src";
import { ModelOptions } from "../src/types";

const MOCK_OPENAI_TIME = 0;
const TEST_FILES_DIR = path.join(__dirname, "data");

interface TestResult {
  numPages: number;
  concurrency: number;
  duration: number;
  avgTimePerPage: number;
}

// Mock the OpenAIModel class
jest.mock("../src/models/openAI", () => {
  return {
    __esModule: true,
    default: class MockOpenAIModel {
      constructor() {
        // Mock constructor
      }

      async getCompletion() {
        await new Promise((resolve) => setTimeout(resolve, MOCK_OPENAI_TIME));
        return {
          content:
            "# Mocked Content\n\nThis is a mocked response for testing purposes.",
          inputTokens: 100,
          outputTokens: 50,
        };
      }
    },
  };
});

// Mock fetch
jest.mock('node-fetch', () => {
  return jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        prompt: "You are a test system prompt. Follow these test instructions...",
        name: "test-prompt",
        version: 1,
        isActive: true
      })
    })
  );
});

describe("Zerox Performance Tests", () => {
  const allResults: TestResult[] = [];

  const runPerformanceTest = async (numPages: number, concurrency: number) => {
    const filePath = path.join(TEST_FILES_DIR, `${numPages}-pages.pdf`);

    console.log(`\nTesting ${numPages} pages with concurrency ${concurrency}`);
    console.time(`Processing ${numPages} pages`);

    const startTime = Date.now();

    const result = await zerox({
      cleanup: true,
      concurrency,
      filePath,
      model: ModelOptions.OPENAI_GPT_4O,
      openaiAPIKey: "mock-key",
    });

    const duration = Date.now() - startTime;
    console.timeEnd(`Processing ${numPages} pages`);

    return {
      numPages,
      concurrency,
      duration,
      avgTimePerPage: duration / numPages,
      successRate:
        ((result.summary.ocr?.successful || 0) / result.summary.totalPages) *
        100,
    };
  };

  const testCases = [
    { pages: 1, concurrency: 20 },
    { pages: 10, concurrency: 20 },
    { pages: 20, concurrency: 20 },
    { pages: 30, concurrency: 20 },
    { pages: 50, concurrency: 20 },
    { pages: 100, concurrency: 20 },
    { pages: 1, concurrency: 50 },
    { pages: 10, concurrency: 50 },
    { pages: 20, concurrency: 50 },
    { pages: 30, concurrency: 50 },
    { pages: 50, concurrency: 50 },
    { pages: 100, concurrency: 50 },
  ];

  test.each(testCases)(
    "Performance test with $pages pages and concurrency $concurrency",
    async ({ pages, concurrency }) => {
      const results = await runPerformanceTest(pages, concurrency);
      allResults.push(results);

      console.table({
        "Number of Pages": results.numPages,
        Concurrency: results.concurrency,
        "Total Duration (ms)": results.duration,
        "Avg Time per Page (ms)": Math.round(results.avgTimePerPage),
      });

      expect(results.duration).toBeGreaterThan(0);
    },
    // Set timeout to accommodate larger tests
    120000
  );

  afterAll(() => {
    // Print performance comparison
    console.log("\n=== FINAL PERFORMANCE COMPARISON ===");
    const comparisonTable = Array.from(new Set(testCases.map((tc) => tc.pages)))
      .sort((a, b) => a - b)
      .map((pages) => {
        const c20 = allResults.find(
          (r) => r.numPages === pages && r.concurrency === 20
        );
        const c50 = allResults.find(
          (r) => r.numPages === pages && r.concurrency === 50
        );
        return {
          Pages: pages,
          "Time (concurrency=20) (s)": c20
            ? (c20.duration / 1000).toFixed(2)
            : "N/A",
          "Time (concurrency=50) (s)": c50
            ? (c50.duration / 1000).toFixed(2)
            : "N/A",
          Improvement:
            c20 && c50
              ? `${((1 - c50.duration / c20.duration) * 100).toFixed(1)}%`
              : "N/A",
        };
      });
    console.table(comparisonTable);
  });
});
