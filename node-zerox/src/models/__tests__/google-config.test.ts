import GoogleModel from "../google";
import { GoogleModelOptions, OperationMode } from "../../types";

const createStubClient = () => ({
  models: {
    generateContent: jest.fn().mockResolvedValue({
      text: "",
      usageMetadata: {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
      },
    }),
  },
});

describe("GoogleModel Gemini 3 configuration", () => {
  const baseParams = { maxOutputTokens: 128 };
  const baseBuffers = [Buffer.from("image-bytes")];

  const gemini3Options: GoogleModelOptions = {
    gemini3: {
      thinkingLevel: "low",
      mediaResolution: "high",
    },
  };

  it("applies Gemini 3 overrides for OCR requests", async () => {
    const client = createStubClient();
    const model = new GoogleModel(
      { apiKey: "test" },
      "gemini-3-pro-preview",
      baseParams,
      gemini3Options,
      client as any
    );

    await model.getCompletion(OperationMode.OCR, {
      buffers: baseBuffers,
      maintainFormat: false,
      priorPage: "",
    });

    expect(client.models.generateContent).toHaveBeenCalledTimes(1);
    const payload = client.models.generateContent.mock.calls[0]?.[0];
    expect(payload.config.thinkingConfig).toEqual({
      thinkingLevel: "THINKING_LEVEL_LOW",
    });
    expect(payload.config.mediaResolution).toBe("MEDIA_RESOLUTION_HIGH");
  });

  it("does not apply overrides for non-Gemini 3 models", async () => {
    const client = createStubClient();
    const model = new GoogleModel(
      { apiKey: "test" },
      "gemini-2.5-pro",
      baseParams,
      gemini3Options,
      client as any
    );

    await model.getCompletion(OperationMode.OCR, {
      buffers: baseBuffers,
      maintainFormat: false,
      priorPage: "",
    });

    const payload = client.models.generateContent.mock.calls[0]?.[0];
    expect(payload.config.thinkingConfig).toBeUndefined();
    expect(payload.config.mediaResolution).toBeUndefined();
  });

  it("applies overrides during extraction requests", async () => {
    const client = createStubClient();
    const model = new GoogleModel(
      { apiKey: "test" },
      "gemini-3-pro-preview",
      baseParams,
      gemini3Options,
      client as any
    );

    await model.getCompletion(OperationMode.EXTRACTION, {
      input: "test",
      schema: { type: "object" },
    } as any);

    const payload = client.models.generateContent.mock.calls[0]?.[0];
    expect(payload.config.thinkingConfig).toEqual({
      thinkingLevel: "THINKING_LEVEL_LOW",
    });
    expect(payload.config.mediaResolution).toBe("MEDIA_RESOLUTION_HIGH");
  });

  it("skips thinking level overrides on Vertex deployments", async () => {
    const client = createStubClient();
    const vertexCredentials = {
      serviceAccount: JSON.stringify({ project_id: "demo" }),
      location: "us-central1",
    };
    const model = new GoogleModel(
      vertexCredentials as any,
      "gemini-3-pro-preview",
      baseParams,
      gemini3Options,
      client as any
    );

    await model.getCompletion(OperationMode.OCR, {
      buffers: baseBuffers,
      maintainFormat: false,
      priorPage: "",
    });

    const payload = client.models.generateContent.mock.calls[0]?.[0];
    expect(payload.config.thinkingConfig).toBeUndefined();
    expect(payload.config.mediaResolution).toBe("MEDIA_RESOLUTION_HIGH");
  });
});
