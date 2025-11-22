import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { cleanupImage } from "../src/utils/image";
import { convertPdfToImages } from "../src/utils/file";
import {
  addWorkersToTesseractScheduler,
  getTesseractScheduler,
  terminateScheduler,
} from "../src/utils/tesseract";

jest.mock("uuid", () => ({
  v4: () => "mocked-uuid",
}));

const INPUT_DIR = path.join(__dirname, "../../shared/inputs");
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
]);

const readFileBuffer = (filePath: string) => fs.promises.readFile(filePath);

const loadBuffersForFile = async (filePath: string): Promise<Buffer[]> => {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) {
    return [await readFileBuffer(filePath)];
  }

  if (ext === ".pdf") {
    const tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "zerox-dpi-test-")
    );
    try {
      const imagePaths = await convertPdfToImages({
        imageDensity: 150,
        imageFormat: "png",
        imageHeight: 2048,
        pagesToConvertAsImages: -1,
        pdfPath: filePath,
        tempDir,
      });

      return await Promise.all(
        imagePaths.map((imagePath) => readFileBuffer(imagePath))
      );
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  }

  throw new Error(`Unsupported file type for DPI test: ${filePath}`);
};

const captureLogsDuring = async (fn: () => Promise<unknown>) => {
  const captured: string[] = [];
  const originalWarn = console.warn;
  const originalError = console.error;

  const wrap = (logger: (...args: any[]) => void) =>
    (...args: any[]) => {
      const message = args.map((arg) => String(arg)).join(" ");
      captured.push(message);
      logger(...args);
    };

  console.warn = wrap(originalWarn);
  console.error = wrap(originalError);

  try {
    await fn();
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }

  return captured.join("\n");
};

describe("Tesseract DPI warnings", () => {
  jest.setTimeout(120000);

  let scheduler: any;

  beforeAll(async () => {
    scheduler = await getTesseractScheduler();
    await addWorkersToTesseractScheduler({ numWorkers: 1, scheduler });
  });

  afterAll(async () => {
    if (scheduler) {
      await terminateScheduler(scheduler);
    }
  });

  it("fails if any shared input triggers invalid resolution warnings", async () => {
    const entries = fs
      .readdirSync(INPUT_DIR)
      .filter((file) => fs.statSync(path.join(INPUT_DIR, file)).isFile())
      .sort();

    for (const fileName of entries) {
      const filePath = path.join(INPUT_DIR, fileName);
      const buffers = await loadBuffersForFile(filePath);

      for (let index = 0; index < buffers.length; index++) {
        const buffer = buffers[index];
        const logOutput = await captureLogsDuring(() =>
          cleanupImage({
            correctOrientation: true,
            imageBuffer: buffer,
            scheduler,
            trimEdges: false,
          })
        );

        if (/Invalid resolution \d+ dpi/i.test(logOutput)) {
          const label = `${fileName}${
            buffers.length > 1 ? `#${index + 1}` : ""
          }`;
          throw new Error(
            `Tesseract emitted an invalid DPI warning for ${label}`
          );
        }
      }
    }
  });
});
