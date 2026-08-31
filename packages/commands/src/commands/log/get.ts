import {
  defineCommand,
  BailianError,
  ExitCode,
  detectOutputFormat,
  effectiveConsoleGatewayConfig,
} from "bailian-cli-core";
import { ansi, emitResult } from "bailian-cli-runtime";
import { formatDateTime } from "../shared/format.ts";
import {
  TELEMETRY_LOG_TIME_FLAGS,
  pollTelemetryData,
  resolveTimeRange,
} from "../shared/telemetry.ts";
import { parseLogUsage, type ModelLogEntry } from "./list.ts";

const LIST_LOGS_API = "zeldaEasy.bailian-telemetry.platform-model.listModelLogs";
const ORIGIN_LOG_API = "zeldaEasy.bailian-telemetry.model.getModelOriginLog";

/** Request IDs are UUID-shaped; the gateway accepts 32-36 chars. */
const REQUEST_ID_LENGTH = { min: 32, max: 36 };

function printLogDetail(entry: ModelLogEntry): void {
  const color = ansi(process.stdout);
  const usage = parseLogUsage(entry.usage);

  const rows: [string, string][] = [
    ["Request ID", entry.modelRequestId],
    ["Model", entry.model ?? "-"],
    ["Time", entry.startTime ? formatDateTime(entry.startTime) : "-"],
    ["Status", entry.httpStatusCode != null ? String(entry.httpStatusCode) : "-"],
    ["Duration", entry.callDuration != null ? `${entry.callDuration} ms` : "-"],
    ["First Token", entry.firstTokenDuration != null ? `${entry.firstTokenDuration} ms` : "-"],
    [
      "Tokens (in/out/total)",
      `${usage.input_tokens ?? "-"}/${usage.output_tokens ?? "-"}/${usage.total_tokens ?? "-"}`,
    ],
  ];
  if (entry.apikeyId) rows.push(["API Key ID", entry.apikeyId]);
  if (entry.errorCode) rows.push(["Error Code", entry.errorCode]);
  if (entry.errorMessage) rows.push(["Error Message", entry.errorMessage]);

  for (const [label, value] of rows) {
    process.stdout.write(`${color.bold(label)}: ${value}\n`);
  }
  if (entry.request) {
    process.stdout.write(`\n${color.bold("Request:")}\n${entry.request}\n`);
  }
  if (entry.response) {
    process.stdout.write(`\n${color.bold("Response:")}\n${entry.response}\n`);
  }
}

export default defineCommand({
  description: {
    "en-US": "Show a single call log with full request/response content",
    "zh-CN": "查看单次调用日志详情（含完整请求/响应内容）",
  },
  auth: "console",
  usageArgs: "--request-id <id> [flags]",
  flags: {
    ...TELEMETRY_LOG_TIME_FLAGS,
    requestId: {
      type: "string",
      valueHint: "<id>",
      required: true,
      description: {
        "en-US": "Model request ID (from `log list`)",
        "zh-CN": "模型请求 ID（可由 log list 获得）",
      },
    },
    model: {
      type: "string",
      valueHint: "<model>",
      description: {
        "en-US": "Model name (narrows the search)",
        "zh-CN": "模型名称（缩小查询范围）",
      },
    },
  },
  exampleArgs: [
    "--request-id 6f6b2f1e-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "--request-id 6f6b2f1e-xxxx-xxxx-xxxx-xxxxxxxxxxxx --hours 24",
    "--request-id 6f6b2f1e-xxxx-xxxx-xxxx-xxxxxxxxxxxx --output json",
  ],
  validate: (flags) => {
    const length = flags.requestId.length;
    if (length < REQUEST_ID_LENGTH.min || length > REQUEST_ID_LENGTH.max) {
      return `--request-id must be ${REQUEST_ID_LENGTH.min}-${REQUEST_ID_LENGTH.max} characters.`;
    }
    return undefined;
  },
  async run(ctx) {
    const { settings, flags } = ctx;
    const format = detectOutputFormat(settings.output);
    // A single request may sit far back; default window is 24h here.
    const { startTime, endTime } = resolveTimeRange(flags, 1);

    const baseReqDTO: Record<string, unknown> = {
      ...(settings.workspaceId
        ? { workspaceId: settings.workspaceId, filterWorkspaceId: settings.workspaceId }
        : {}),
      startTime,
      endTime,
      modelRequestId: flags.requestId,
    };
    if (flags.model) baseReqDTO.models = [flags.model];

    if (settings.dryRun) {
      emitResult(
        {
          apis: [LIST_LOGS_API, ORIGIN_LOG_API],
          data: { reqDTO: { ...baseReqDTO, needFullContent: true } },
          ...effectiveConsoleGatewayConfig(settings),
        },
        format,
      );
      return;
    }

    const resp = await pollTelemetryData(ctx.client, LIST_LOGS_API, {
      ...baseReqDTO,
      maxResults: 1,
      skip: 0,
      needFullContent: true,
    });
    const entry = ((resp.list as ModelLogEntry[]) ?? [])[0];
    if (!entry) {
      throw new BailianError(
        `No log found for request ${flags.requestId} in the selected range.`,
        ExitCode.GENERAL,
        "Widen the window with --hours/--start-time, or check the request ID.",
      );
    }

    const originResp = await pollTelemetryData(ctx.client, ORIGIN_LOG_API, baseReqDTO);
    const originLog = originResp.originLog ?? originResp;

    if (format === "json") {
      emitResult({ ...entry, originLog }, format);
      return;
    }

    printLogDetail(entry);
    if (!entry.request && !entry.response) {
      process.stdout.write(
        ansi(process.stdout).dim(
          "\nRequest/response content is only available when inference log delivery is enabled.\n",
        ),
      );
    }
  },
});
