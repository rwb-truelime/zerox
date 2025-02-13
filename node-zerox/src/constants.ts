// This is a rough guess; this will be used to create Tesseract workers by default,
// that cater to this many pages. If a document has more than this many pages,
// then more workers will be created dynamically.
import fs from "fs";
import path from "path";

// Read the markdown file at runtime; adjust the relative path if necessary.
const systemPromptPath = path.join(__dirname, "../../templates/systemPrompt.md");
export const SYSTEM_PROMPT_BASE = fs.readFileSync(systemPromptPath, "utf8");

// Other constants:
export const NUM_STARTING_WORKERS = 3;
export const CONSISTENCY_PROMPT = (priorPage: string): string =>
  `Markdown must maintain consistent formatting with the following page: \n\n """${priorPage}"""`;
