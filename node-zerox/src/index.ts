import fs from "fs-extra";
import os from "os";
import path from "path";
import pLimit from "p-limit";
import Tesseract from "tesseract.js";

import "./handleWarnings";
import {
  addWorkersToTesseractScheduler,
  checkIsCFBFile,
  cleanupImage,
  CompletionProcessor,
  compressImage,
  convertFileToPdf,
  convertHeicToJpeg,
  convertPdfToImages,
  downloadFile,
  extractPagesFromStructuredDataFile,
  getNumberOfPagesFromPdf,
  getTesseractScheduler,
  isCompletionResponse,
  isStructuredDataFile,
  prepareWorkersForImageProcessing,
  runRetries,
  splitSchema,
  terminateScheduler,
} from "./utils";
import { createModel } from "./models";
import {
  CompletionResponse,
  ErrorMode,
  ExtractionResponse,
  HybridInput,
  LogprobPage,
  ModelOptions,
  ModelProvider,
  OperationMode,
  Page,
  PageStatus,
  ZeroxArgs,
  ZeroxOutput,
} from "./types";
import { NUM_STARTING_WORKERS } from "./constants";

export * from './types';

export const zerox = async ({
  cleanup = true,
  concurrency = 10,
  correctOrientation = true,
  credentials = { apiKey: "" },
  customModelFunction,
  directImageExtraction = false,
  enableHybridExtraction = false,
  errorMode = ErrorMode.IGNORE,
  extractionCredentials,
  extractionLlmParams,
  extractionModel,
  extractionModelProvider,
  extractionPrompt,
  extractOnly = false,
  extractPerPage,
  filePath,
  imageDensity,
  imageHeight,
  llmParams = {},
  maintainFormat = false,
  maxImageSize = 15,
  maxRetries = 1,
  maxTesseractWorkers = -1,
  model = ModelOptions.OPENAI_GPT_4O,
  modelProvider = ModelProvider.OPENAI,
  openaiAPIKey = "",
  outputDir,
  pagesToConvertAsImages = -1,
  prompt,
  schema,
  tempDir = os.tmpdir(),
  trimEdges = true,
}: ZeroxArgs): Promise<ZeroxOutput> => {
  console.log("Starting Zerox process...");
  let extracted: Record<string, unknown> | null = null;

  let extractedLogprobs: LogprobPage[] = [];
  let inputTokenCount: number = 0;
  let outputTokenCount: number = 0;
  let numSuccessfulOCRRequests: number = 0;
  let numFailedOCRRequests: number = 0;
  let ocrLogprobs: LogprobPage[] = [];
  let priorPage: string = "";
  let pages: Page[] = [];
  let imagePaths: string[] = [];
  const startTime = new Date();

  console.log("Validating arguments...");
  if (openaiAPIKey && openaiAPIKey.length > 0) {
    modelProvider = ModelProvider.OPENAI;
    credentials = { apiKey: openaiAPIKey };
  }

  extractionCredentials = extractionCredentials ?? credentials;
  extractionLlmParams = extractionLlmParams ?? llmParams;
  extractionModel = extractionModel ?? model;
  extractionModelProvider = extractionModelProvider ?? modelProvider;

  // Validators
  if (Object.values(credentials).every((credential) => !credential)) {
    throw new Error("Missing credentials");
  }
  if (!filePath || !filePath.length) {
    throw new Error("Missing file path");
  }
  if (enableHybridExtraction && (directImageExtraction || extractOnly)) {
    throw new Error(
      "Hybrid extraction cannot be used in direct image extraction or extract-only mode"
    );
  }
  if (enableHybridExtraction && !schema) {
    throw new Error("Schema is required when hybrid extraction is enabled");
  }
  if (extractOnly && !schema) {
    throw new Error("Schema is required for extraction mode");
  }
  if (extractOnly && maintainFormat) {
    throw new Error("Maintain format is only supported in OCR mode");
  }

  if (extractOnly) directImageExtraction = true;

  let scheduler: Tesseract.Scheduler | null = null;
  let tempDirectory: string | null = null; // Define tempDirectory here to access in finally block

  // Add initial tesseract workers if we need to correct orientation
  if (correctOrientation) {
    console.log("Initializing Tesseract scheduler for orientation correction...");
    scheduler = await getTesseractScheduler();
    const workerCount =
      maxTesseractWorkers !== -1 && maxTesseractWorkers < NUM_STARTING_WORKERS
        ? maxTesseractWorkers
        : NUM_STARTING_WORKERS;
    await addWorkersToTesseractScheduler({
      numWorkers: workerCount,
      scheduler,
    });
    console.log(`Added ${workerCount} Tesseract workers.`);
  }

  try {
    // Ensure temp directory exists + create temp folder
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    tempDirectory = path.join(
      tempDir || os.tmpdir(),
      `zerox-temp-${rand}`
    );
    const sourceDirectory = path.join(tempDirectory, "source");
    console.log("Creating temporary directory:", tempDirectory);
    await fs.ensureDir(sourceDirectory);

    // Download the PDF. Get file name.
    console.log("Downloading/copying file:", filePath);
    const { extension, localPath } = await downloadFile({
      filePath,
      tempDir: sourceDirectory,
    });
    console.log("File downloaded/copied to:", localPath);

    if (!localPath) throw "Failed to save file to local drive";

    // Sort the `pagesToConvertAsImages` array to make sure we use the right index
    // for `formattedPages` as `pdf2pic` always returns images in order
    if (Array.isArray(pagesToConvertAsImages)) {
      pagesToConvertAsImages.sort((a, b) => a - b);
    }

    // Check if the file is a structured data file (like Excel).
    // If so, skip the image conversion process and extract the pages directly
    console.log("Checking file type...");
    if (isStructuredDataFile(localPath)) {
      console.log("File identified as structured data:", localPath);
      console.log("Extracting pages from structured data file...");
      pages = await extractPagesFromStructuredDataFile(localPath);
      console.log(`Extracted ${pages.length} pages from structured data.`);
    } else {
      console.log("File identified as image/document:", localPath);
      // Read the image file or convert the file to images
      if (
        extension === ".png" ||
        extension === ".jpg" ||
        extension === ".jpeg"
      ) {
        console.log("File is an image.");
        imagePaths = [localPath];
      } else if (extension === ".heic") {
        console.log("Converting HEIC to JPEG:", localPath);
        const imagePath = await convertHeicToJpeg({
          localPath,
          tempDir: sourceDirectory,
        });
        imagePaths = [imagePath];
        console.log("HEIC converted to JPEG:", imagePath);
      } else {
        let pdfPath: string;
        const isCFBFile = await checkIsCFBFile(localPath);
        if (extension === ".pdf" && !isCFBFile) {
          console.log("File is a standard PDF.");
          pdfPath = localPath;
        } else {
          console.log("Converting file to PDF:", localPath);
          pdfPath = await convertFileToPdf({
            extension,
            localPath,
            tempDir: sourceDirectory,
          });
          console.log("File converted to PDF:", pdfPath);
        }
        console.log("Converting PDF to images:", pdfPath);
        if (pagesToConvertAsImages !== -1) {
          const totalPages = await getNumberOfPagesFromPdf({ pdfPath });
          pagesToConvertAsImages = Array.isArray(pagesToConvertAsImages)
            ? pagesToConvertAsImages
            : [pagesToConvertAsImages];
          pagesToConvertAsImages = pagesToConvertAsImages.filter(
            (page) => page > 0 && page <= totalPages
          );
          console.log("Target pages for image conversion:", pagesToConvertAsImages);
        } else {
          console.log("Converting all pages to images.");
        }
        imagePaths = await convertPdfToImages({
          imageDensity,
          imageHeight,
          pagesToConvertAsImages,
          pdfPath,
          tempDir: sourceDirectory,
        });
        console.log(`Converted PDF to ${imagePaths.length} images.`);
      }

      // Compress images if maxImageSize is specified
      if (maxImageSize && maxImageSize > 0) {
        console.log("Compressing images...");
        const compressPromises = imagePaths.map(async (imagePath: string) => {
          const imageBuffer = await fs.readFile(imagePath);
          const compressedBuffer = await compressImage(
            imageBuffer,
            maxImageSize
          );
          const originalName = path.basename(
            imagePath,
            path.extname(imagePath)
          );
          const compressedPath = path.join(
            sourceDirectory,
            `${originalName}_compressed.png`
          );
          await fs.writeFile(compressedPath, compressedBuffer);
          return compressedPath;
        });

        imagePaths = await Promise.all(compressPromises);
        console.log("Image compression finished.");
      }

      if (correctOrientation) {
        console.log("Preparing Tesseract workers for image processing...");
        await prepareWorkersForImageProcessing({
          maxTesseractWorkers,
          numImages: imagePaths.length,
          scheduler,
        });
        console.log("Tesseract workers prepared.");
      }

      // Start processing OCR using LLM
      const modelInstance = createModel({
        credentials,
        llmParams,
        model,
        provider: modelProvider,
      });

      if (!extractOnly) {
        console.log("Starting OCR processing...");
        const processOCR = async (
          imagePath: string,
          pageNumber: number,
          maintainFormat: boolean
        ): Promise<Page> => {
          console.log(`Processing OCR for page ${pageNumber}...`);
          const imageBuffer = await fs.readFile(imagePath);
          console.log(`Cleaning image for page ${pageNumber}...`);
          const buffers = await cleanupImage({
            correctOrientation,
            imageBuffer,
            scheduler,
            trimEdges,
          });
          console.log(`Image cleaned for page ${pageNumber}.`);

          let page: Page;
          try {
            let rawResponse: CompletionResponse | ExtractionResponse;
            console.log(`Requesting LLM completion for page ${pageNumber}...`);
            if (customModelFunction) {
              rawResponse = await runRetries(
                () =>
                  customModelFunction({
                    buffers,
                    image: imagePath,
                    maintainFormat,
                    priorPage,
                  }),
                maxRetries,
                pageNumber
              );
            } else {
              rawResponse = await runRetries(
                () =>
                  modelInstance.getCompletion(OperationMode.OCR, {
                    buffers,
                    maintainFormat,
                    priorPage,
                    prompt,
                  }),
                maxRetries,
                pageNumber
              );
            }
            console.log(`LLM completion received for page ${pageNumber}.`);

            if (rawResponse.logprobs) {
              ocrLogprobs.push({
                page: pageNumber,
                value: rawResponse.logprobs,
              });
            }

            const response = CompletionProcessor.process(
              OperationMode.OCR,
              rawResponse
            );

            inputTokenCount += response.inputTokens;
            outputTokenCount += response.outputTokens;

            if (isCompletionResponse(OperationMode.OCR, response)) {
              priorPage = response.content;
            }

            page = {
              ...response,
              page: pageNumber,
              status: PageStatus.SUCCESS,
            };
            numSuccessfulOCRRequests++;
            console.log(`OCR successful for page ${pageNumber}.`);
          } catch (error) {
            console.error(`OCR failed for page ${pageNumber}:`, error);
            if (errorMode === ErrorMode.THROW) {
              throw error;
            }

            page = {
              content: "",
              contentLength: 0,
              error: `Failed to process page ${pageNumber}: ${error}`,
              page: pageNumber,
              status: PageStatus.ERROR,
            };
            numFailedOCRRequests++;
          }

          return page;
        };

        if (maintainFormat) {
          console.log("Processing OCR sequentially (maintainFormat=true)...");
          // Use synchronous processing
          for (let i = 0; i < imagePaths.length; i++) {
            const page = await processOCR(imagePaths[i], i + 1, true);
            pages.push(page);
            if (page.status === PageStatus.ERROR) {
              console.error(`Stopping OCR due to error on page ${i + 1}.`);
              break;
            }
          }
        } else {
          console.log(`Processing OCR concurrently (concurrency=${concurrency})...`);
          const limit = pLimit(concurrency);
          await Promise.all(
            imagePaths.map((imagePath, i) =>
              limit(() =>
                processOCR(imagePath, i + 1, false).then((page) => {
                  pages[i] = page;
                })
              )
            )
          );
        }
        console.log("OCR processing finished.");
      } else {
        console.log("Skipping OCR processing (extractOnly=true).");
      }
    }

    // Start processing extraction using LLM
    let numSuccessfulExtractionRequests: number = 0;
    let numFailedExtractionRequests: number = 0;

    if (schema) {
      console.log("Starting extraction processing...");
      const extractionModelInstance = createModel({
        credentials: extractionCredentials,
        llmParams: extractionLlmParams,
        model: extractionModel,
        provider: extractionModelProvider,
      });

      const { fullDocSchema, perPageSchema } = splitSchema(
        schema,
        extractPerPage
      );
      const extractionTasks: Promise<any>[] = [];

      const processExtraction = async (
        input: string | string[] | HybridInput,
        pageNumber: number | null, // null for full document
        schema: Record<string, unknown>
      ): Promise<Record<string, unknown>> => {
        const target = pageNumber ? `page ${pageNumber}` : 'full document';
        console.log(`Processing extraction for ${target}...`);
        let result: Record<string, unknown> = {};
        try {
          await runRetries(
            async () => {
              console.log(`Requesting LLM extraction for ${target}...`);
              const rawResponse = await extractionModelInstance.getCompletion(
                OperationMode.EXTRACTION,
                {
                  input,
                  options: { correctOrientation, scheduler, trimEdges },
                  prompt: extractionPrompt,
                  schema,
                }
              );
              console.log(`LLM extraction received for ${target}.`);

              if (rawResponse.logprobs) {
                extractedLogprobs.push({
                  page: pageNumber,
                  value: rawResponse.logprobs,
                });
              }

              const response = CompletionProcessor.process(
                OperationMode.EXTRACTION,
                rawResponse
              );

              inputTokenCount += response.inputTokens;
              outputTokenCount += response.outputTokens;

              numSuccessfulExtractionRequests++;
              console.log(`Extraction successful for ${target}.`);

              for (const key of Object.keys(schema?.properties ?? {})) {
                const value = response.extracted[key];
                if (value !== null && value !== undefined) {
                  if (!Array.isArray(result[key])) {
                    result[key] = [];
                  }
                  (result[key] as any[]).push({ page: pageNumber, value });
                }
              }
            },
            maxRetries,
            pageNumber ?? 0 // Use 0 for full document retries
          );
        } catch (error) {
          numFailedExtractionRequests++;
          console.error(`Extraction failed for ${target}:`, error);
          throw error; // Re-throw after logging
        }

        return result;
      };

      if (perPageSchema) {
        console.log("Processing per-page extractions...");
        const inputs =
          directImageExtraction && !isStructuredDataFile(localPath)
            ? imagePaths.map((imagePath) => [imagePath])
            : enableHybridExtraction
            ? imagePaths.map((imagePath, index) => ({
                imagePaths: [imagePath],
                text: pages[index].content || "",
              }))
            : pages.map((page) => page.content || "");

        extractionTasks.push(
          ...inputs.map((input, i) =>
            processExtraction(input, i + 1, perPageSchema)
          )
        );
      }

      if (fullDocSchema) {
        console.log("Processing full-document extraction...");
        const input =
          directImageExtraction && !isStructuredDataFile(localPath)
            ? imagePaths
            : enableHybridExtraction
            ? {
                imagePaths,
                text: pages
                  .map((page, i) =>
                    i === 0 ? page.content : "\n<hr><hr>\n" + page.content
                  )
                  .join(""),
              }
            : pages
                .map((page, i) =>
                  i === 0 ? page.content : "\n<hr><hr>\n" + page.content
                )
                .join("");

        extractionTasks.push(
          (async () => {
            let result: Record<string, unknown> = {};
            try {
              await runRetries(
                async () => {
                  console.log("Requesting LLM extraction for full document...");
                  const rawResponse =
                    await extractionModelInstance.getCompletion(
                      OperationMode.EXTRACTION,
                      {
                        input,
                        options: { correctOrientation, scheduler, trimEdges },
                        prompt: extractionPrompt,
                        schema: fullDocSchema,
                      }
                    );
                  console.log("LLM extraction received for full document.");

                  if (rawResponse.logprobs) {
                    extractedLogprobs.push({
                      page: null,
                      value: rawResponse.logprobs,
                    });
                  }

                  const response = CompletionProcessor.process(
                    OperationMode.EXTRACTION,
                    rawResponse
                  );

                  inputTokenCount += response.inputTokens;
                  outputTokenCount += response.outputTokens;
                  numSuccessfulExtractionRequests++;
                  result = response.extracted;
                  console.log("Extraction successful for full document.");
                },
                maxRetries,
                0
              );
              return result;
            } catch (error) {
              numFailedExtractionRequests++;
              console.error("Extraction failed for full document:", error);
              throw error; // Re-throw after logging
            }
          })()
        );
      }

      const results = await Promise.all(extractionTasks);
      extracted = results.reduce((acc, result) => {
        Object.entries(result || {}).forEach(([key, value]) => {
          if (!acc[key]) {
            acc[key] = [];
          }
          if (Array.isArray(value)) {
            acc[key].push(...value);
          } else {
            acc[key] = value;
          }
        });
        return acc;
      }, {});
      console.log("Extraction processing finished.");
    } else {
      console.log("Skipping extraction processing (no schema provided).");
    }

    // Write the aggregated markdown to a file
    const endOfPath = localPath.split("/")[localPath.split("/").length - 1];
    const rawFileName = endOfPath.split(".")[0];
    const fileName = rawFileName
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "_")
      .toLowerCase()
      .substring(0, 255); // Truncate file name to 255 characters to prevent ENAMETOOLONG errors

    if (outputDir) {
      const resultFilePath = path.join(outputDir, `${fileName}.md`);
      console.log("Writing output file:", resultFilePath);
      const content = pages.map((page) => page.content).join("\n\n");
      await fs.writeFile(resultFilePath, content);
      console.log("Output file written successfully.");
    } else {
      console.log("Skipping output file write (no outputDir provided).");
    }

    // Cleanup the downloaded PDF file
    if (cleanup && tempDirectory) {
      console.log("Cleaning up temporary directory:", tempDirectory);
      await fs.remove(tempDirectory);
      console.log("Temporary directory cleaned up.");
    } else {
      console.log("Skipping cleanup.");
    }

    // Format JSON response
    const endTime = new Date();
    const completionTime = endTime.getTime() - startTime.getTime();
    console.log(`Zerox process finished successfully in ${completionTime}ms.`);

    const formattedPages = pages.map((page, i) => {
      let correctPageNumber;
      // If we convert all pages, just use the array index
      if (pagesToConvertAsImages === -1) {
        correctPageNumber = i + 1;
      }
      // Else if we convert specific pages, use the page number from the parameter
      else if (Array.isArray(pagesToConvertAsImages)) {
        correctPageNumber = pagesToConvertAsImages[i];
      }
      // Else, the parameter is a number and use it for the page number
      else {
        correctPageNumber = pagesToConvertAsImages;
      }

      // Return the page with the correct page number
      const result: Page = {
        ...page,
        page: correctPageNumber,
      };

      return result;
    });

    return {
      completionTime,
      extracted,
      fileName,
      inputTokens: inputTokenCount,
      ...(ocrLogprobs.length || extractedLogprobs.length
        ? {
            logprobs: {
              ocr: !extractOnly ? ocrLogprobs : null,
              extracted: schema ? extractedLogprobs : null,
            },
          }
        : {}),
      outputTokens: outputTokenCount,
      pages: formattedPages,
      summary: {
        totalPages: pages.length,
        ocr: !extractOnly
          ? {
              successful: numSuccessfulOCRRequests,
              failed: numFailedOCRRequests,
            }
          : null,
        extracted: schema
          ? {
              successful: numSuccessfulExtractionRequests,
              failed: numFailedExtractionRequests,
            }
          : null,
      },
    };
  } finally {
    if (correctOrientation && scheduler) {
      console.log("Terminating Tesseract scheduler.");
      terminateScheduler(scheduler);
      console.log("Tesseract scheduler terminated.");
    }
    // Ensure cleanup happens even if an error occurs before tempDirectory is set
    if (cleanup && tempDirectory && await fs.pathExists(tempDirectory)) {
        try {
            console.log("Ensuring temporary directory cleanup in finally block:", tempDirectory);
            await fs.remove(tempDirectory);
            console.log("Temporary directory cleaned up in finally block.");
        } catch (cleanupError) {
            console.error("Error during final cleanup:", cleanupError);
        }
    }
  }
};
