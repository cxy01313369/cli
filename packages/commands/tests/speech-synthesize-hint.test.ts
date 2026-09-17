import { describe, expect, test } from "vite-plus/test";
import { BailianError, ExitCode } from "bailian-cli-core";
import {
  isTtsModelNotFound,
  isTtsVoiceMismatch,
  rethrowWithSpeechSynthesizeHint,
  speechSynthesizeModelNotFoundHint,
  speechSynthesizeVoiceMismatchHint,
} from "../src/commands/speech/synthesize-hint.ts";

describe("speech-synthesize-hint", () => {
  test("detects ModelNotFound / model not exist", () => {
    expect(
      isTtsModelNotFound(
        new BailianError("Model not exist", ExitCode.GENERAL, undefined, {
          api: { httpStatus: 404 },
        }),
      ),
    ).toBe(true);
    expect(
      isTtsModelNotFound(
        new BailianError("Unknown model", ExitCode.GENERAL, undefined, {
          api: { httpStatus: 404, apiCode: "ModelNotFound" },
        }),
      ),
    ).toBe(true);
    expect(
      isTtsModelNotFound(new BailianError("model 'cosyvoice-v3-flash' not found or not supported")),
    ).toBe(true);
    expect(isTtsModelNotFound(new BailianError("rate limit exceeded"))).toBe(false);
  });

  test("does not treat bare 404 or capability errors as model-not-found", () => {
    expect(
      isTtsModelNotFound(
        new BailianError("Not Found", ExitCode.GENERAL, undefined, { api: { httpStatus: 404 } }),
      ),
    ).toBe(false);
    expect(isTtsModelNotFound(new BailianError("this model is not supported for SSML"))).toBe(
      false,
    );
    expect(
      isTtsModelNotFound(new BailianError("Download failed: HTTP 404", ExitCode.GENERAL)),
    ).toBe(false);
  });

  test("detects Engine error [411]", () => {
    expect(
      isTtsVoiceMismatch(
        new BailianError(
          "[cosyvoice:]Engine error [411]: TTS speak operation failed",
          ExitCode.GENERAL,
          undefined,
          { api: { httpStatus: 400, apiCode: "InvalidParameter" } },
        ),
      ),
    ).toBe(true);
    expect(isTtsVoiceMismatch(new BailianError("InvalidParameter: bad format"))).toBe(false);
  });

  test("does not treat other CosyVoice 400s as voice mismatch", () => {
    expect(
      isTtsVoiceMismatch(
        new BailianError("[cosyvoice:] invalid sample rate", ExitCode.GENERAL, undefined, {
          api: { httpStatus: 400, apiCode: "InvalidParameter" },
        }),
      ),
    ).toBe(false);
    expect(
      isTtsVoiceMismatch(
        new BailianError(
          "InvalidParameter: this voice does not support instruction",
          ExitCode.GENERAL,
          undefined,
          {
            api: { httpStatus: 400, apiCode: "InvalidParameter" },
          },
        ),
      ),
    ).toBe(false);
    expect(
      isTtsVoiceMismatch(
        new BailianError("TTS speak operation failed", ExitCode.GENERAL, undefined, {
          api: { httpStatus: 400, apiCode: "InvalidParameter" },
        }),
      ),
    ).toBe(false);
  });

  test("404 hint points to list-voices --model and plan guidance", () => {
    const hint = speechSynthesizeModelNotFoundHint("bl", "cosyvoice-v3-flash");
    expect(hint).toContain("cosyvoice-v3-flash");
    expect(hint).toContain("bl speech synthesize --list-voices --model cosyvoice-v3-flash");
    expect(hint).toMatch(/endpoint or plan/i);
  });

  test("411 hint points to model list-voices and docs", () => {
    const hint = speechSynthesizeVoiceMismatchHint("bl", "qwen-audio-3.0-tts-plus");
    expect(hint).toContain("qwen-audio-3.0-tts-plus");
    expect(hint).toContain("--list-voices --model qwen-audio-3.0-tts-plus");
    expect(hint).toContain("qwen-audio-tts-voice-list");
  });

  test("on match keeps server message and attaches hint without nesting BailianError as cause", () => {
    const original = new BailianError(
      "[cosyvoice:]Engine error [411]: TTS speak operation failed",
      ExitCode.GENERAL,
      undefined,
      { api: { httpStatus: 400, apiCode: "InvalidParameter" } },
    );
    try {
      rethrowWithSpeechSynthesizeHint(original, {
        binName: "bl",
        model: "qwen-audio-3.0-tts-plus",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BailianError);
      const wrapped = error as BailianError;
      expect(wrapped.message).toBe(original.message);
      expect(wrapped.exitCode).toBe(ExitCode.GENERAL);
      expect(wrapped.hint).toMatch(/list-voices/);
      expect(wrapped.api?.httpStatus).toBe(400);
      expect(wrapped.cause).toBeUndefined();
      expect(wrapped.toJSON().error).not.toHaveProperty("cause");
    }

    const rootCause = new Error("ECONNRESET");
    const withCause = new BailianError(
      "[cosyvoice:]Engine error [411]: TTS speak operation failed",
      ExitCode.GENERAL,
      undefined,
      { cause: rootCause, api: { httpStatus: 400, apiCode: "InvalidParameter" } },
    );
    try {
      rethrowWithSpeechSynthesizeHint(withCause, {
        binName: "bl",
        model: "qwen-audio-3.0-tts-plus",
      });
      expect.unreachable();
    } catch (error) {
      const wrapped = error as BailianError;
      expect(wrapped.cause).toBe(rootCause);
      expect(wrapped.cause).not.toBe(withCause);
    }
  });

  test("preserves existing hint or non-target errors", () => {
    const withHint = new BailianError("Model not exist", ExitCode.GENERAL, "keep me", {
      api: { httpStatus: 404 },
    });
    try {
      rethrowWithSpeechSynthesizeHint(withHint, { binName: "bl", model: "x" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBe(withHint);
    }

    const other = new BailianError("quota exceeded", ExitCode.GENERAL);
    try {
      rethrowWithSpeechSynthesizeHint(other, { binName: "bl", model: "x" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBe(other);
    }
  });
});
