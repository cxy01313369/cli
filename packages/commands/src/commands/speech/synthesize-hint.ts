import { BailianError, DOCS_HOSTS } from "bailian-cli-core";
import { VOICE_TTS_PAGE } from "bailian-cli-runtime";

const QWEN_AUDIO_TTS_VOICE_DOC = `${DOCS_HOSTS.cn}/qwen-audio-tts-voice-list`;

/** model in current endpoint/plan is not available (e.g. CosyVoice in Token Plan). */
export function isTtsModelNotFound(error: unknown): boolean {
  if (!(error instanceof BailianError)) return false;
  const apiCode = error.api?.apiCode ?? "";
  if (/\bModelNotFound\b/i.test(apiCode)) return true;
  return /\bModelNotFound\b|model[^\n]{0,80}?\b(not\s+exist|does\s+not\s+exist|not\s+found)\b/i.test(
    error.message,
  );
}

/** Voice mismatch (Engine error [411] as shown in the official documentation). */
export function isTtsVoiceMismatch(error: unknown): boolean {
  if (!(error instanceof BailianError)) return false;
  return /Engine\s+error\s*\[411\]/i.test(error.message);
}

function voiceDocsUrl(model: string): string {
  if (model.startsWith("qwen-audio-")) return QWEN_AUDIO_TTS_VOICE_DOC;
  return VOICE_TTS_PAGE;
}

export function speechSynthesizeModelNotFoundHint(binName: string, model: string): string {
  return [
    `Model "${model}" may not be available on the current endpoint or plan.`,
    `Try the Profile default speech model, or check the Token Plan model list.`,
    `List built-in voices: \`${binName} speech synthesize --list-voices --model ${model}\`.`,
  ].join(" ");
}

export function speechSynthesizeVoiceMismatchHint(binName: string, model: string): string {
  return [
    `The voice may not match model "${model}".`,
    `Run \`${binName} speech synthesize --list-voices --model ${model}\` for built-in voices.`,
    `Official voice list: ${voiceDocsUrl(model)}`,
  ].join(" ");
}

/**
 * Keep the server message; attach a hint only for known TTS failure shapes.
 * Does not overwrite an existing hint.
 */
export function rethrowWithSpeechSynthesizeHint(
  error: unknown,
  options: { binName: string; model: string },
): never {
  if (!(error instanceof BailianError) || error.hint) {
    throw error;
  }

  const { binName, model } = options;
  let hint: string | undefined;
  if (isTtsModelNotFound(error)) {
    hint = speechSynthesizeModelNotFoundHint(binName, model);
  } else if (isTtsVoiceMismatch(error)) {
    hint = speechSynthesizeVoiceMismatchHint(binName, model);
  }

  if (!hint) throw error;

  // 透传原 cause，不把当前 BailianError 再套一层，避免 text/JSON 重复同一句 message
  throw new BailianError(error.message, error.exitCode, hint, {
    cause: error.cause,
    api: error.api,
    rawResponse: error.rawResponse,
  });
}
