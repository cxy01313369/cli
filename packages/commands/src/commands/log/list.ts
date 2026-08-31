import { defineCommand, detectOutputFormat, effectiveConsoleGatewayConfig } from "bailian-cli-core";
import { ansi, emitResult, renderBoxTable } from "bailian-cli-runtime";
import { formatNumber, formatDateTime } from "../shared/format.ts";
import { parseCommaList } from "../shared/params.ts";
import {
  TELEMETRY_LOG_TIME_FLAGS,
  TELEMETRY_FILTER_FLAGS,
  buildTelemetryFilters,
  pollTelemetryData,
  resolveTimeRange,
} from "../shared/telemetry.ts";

export const LIST_LOGS_API = "zeldaEasy.bailian-telemetry.platform-model.listModelLogs";

const STATUS_CODE_TYPES = ["SUCCESS", "CLIENT_ERROR", "SERVER_ERROR", "CANCEL"] as const;

export interface ModelLogEntry {
  modelRequestId: string;
  model: string;
  apiKey?: string;
  apikeyId?: string;
  request?: string;
  response?: string;
  startTime: number;
  callDuration: number;
  httpStatusCode: number;
  errorCode?: string;
  errorMessage?: string;
  firstTokenDuration?: number;
  usage?: { input_tokens?: string; output_tokens?: string; total_tokens?: string } | string;
  channel?: string;
  source?: string;
}

/** usage arrives as a JSON string on some paths, an object on others. */
export function parseLogUsage(usage: ModelLogEntry["usage"]): {
  input_tokens?: string;
  output_tokens?: string;
  total_tokens?: string;
} {
  if (!usage) return {};
  if (typeof usage === "string") {
    try {
      return JSON.parse(usage) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return usage;
}

export function printLogTable(list: ModelLogEntry[]): void {
  const color = ansi(process.stdout);

  if (list.length === 0) {
    process.stdout.write("No logs found in this range.\n");
    return;
  }

  const lines = renderBoxTable({
    headers: ["Time", "Request ID", "Model", "Status", "Duration", "First Token", "Tokens"],
    rows: list.map((entry) => {
      const usage = parseLogUsage(entry.usage);
      const tokens =
        usage.input_tokens != null || usage.output_tokens != null
          ? `${usage.input_tokens ?? "-"}/${usage.output_tokens ?? "-"}`
          : "-";
      return [
        formatDateTime(entry.startTime),
        entry.modelRequestId ?? "-",
        entry.model ?? "-",
        entry.httpStatusCode != null ? String(entry.httpStatusCode) : "-",
        entry.callDuration != null ? `${formatNumber(entry.callDuration)} ms` : "-",
        entry.firstTokenDuration != null ? `${formatNumber(entry.firstTokenDuration)} ms` : "-",
        tokens,
      ];
    }),
    align: ["left", "left", "left", "right", "right", "right", "right"],
    cellColor: (_rowIndex, colIndex, value) => {
      if (colIndex !== 3) return undefined;
      if (value.startsWith("2")) return color.green(value);
      if (value.startsWith("5")) return color.red(value);
      if (value === "-") return undefined;
      return color.yellow(value);
    },
  });
  for (const line of lines) process.stdout.write(line + "\n");
}

export default defineCommand({
  description: {
    "en-US": "Query model call logs (audit trail; use --full for request/response content)",
    "zh-CN": "查询模型调用日志（审计口径；--full 携带请求/响应内容）",
  },
  auth: "console",
  usageArgs: "[--model <model>] [--hours <n>] [flags]",
  flags: {
    ...TELEMETRY_LOG_TIME_FLAGS,
    ...TELEMETRY_FILTER_FLAGS,
    requestId: {
      type: "string",
      valueHint: "<id>",
      description: {
        "en-US": "Exact model request ID",
        "zh-CN": "精确匹配模型请求 ID",
      },
    },
    statusCode: {
      type: "string",
      valueHint: "<type>",
      description: {
        "en-US": `Status filter(s), comma-separated: ${STATUS_CODE_TYPES.join(", ")}`,
        "zh-CN": `状态过滤，多个以逗号分隔：${STATUS_CODE_TYPES.join("、")}`,
      },
    },
    full: {
      type: "switch",
      description: {
        "en-US": "Include full request/response content (requires inference log delivery)",
        "zh-CN": "携带完整请求/响应内容（需已开启推理日志投递）",
      },
    },
    maxResults: {
      type: "number",
      valueHint: "<n>",
      description: {
        "en-US": "Rows per page (default: 20)",
        "zh-CN": "每页数量（默认：20）",
      },
    },
    skip: {
      type: "number",
      valueHint: "<n>",
      description: {
        "en-US": "Rows to skip (default: 0)",
        "zh-CN": "跳过的记录数（默认：0）",
      },
    },
    nextToken: {
      type: "string",
      valueHint: "<token>",
      description: {
        "en-US": "Pagination token from a previous response",
        "zh-CN": "上一次响应返回的分页标记",
      },
    },
  },
  exampleArgs: [
    "",
    "--model qwen3.6-plus --hours 3",
    "--status-code SERVER_ERROR,CLIENT_ERROR",
    "--request-id 6f6b2f1e-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "--full --model qwen3.6-plus --output json",
  ],
  validate: (flags) => {
    if (flags.statusCode) {
      const unknown = parseCommaList(flags.statusCode).filter(
        (item) => !(STATUS_CODE_TYPES as readonly string[]).includes(item),
      );
      if (unknown.length > 0) {
        return `Unknown status code type: ${unknown.join(", ")}. Valid: ${STATUS_CODE_TYPES.join(", ")}.`;
      }
    }
    if (flags.hours != null && flags.hours <= 0) {
      return "--hours must be positive.";
    }
    return undefined;
  },
  async run(ctx) {
    const { settings, flags } = ctx;
    const format = detectOutputFormat(settings.output);
    const { startTime, endTime } = resolveTimeRange(flags, 1 / 24);

    const reqDTO: Record<string, unknown> = {
      ...buildTelemetryFilters(flags, settings.workspaceId),
      filterWorkspaceId: settings.workspaceId,
      startTime,
      endTime,
      maxResults: flags.maxResults ?? 20,
      skip: flags.skip ?? 0,
      nextToken: flags.nextToken,
      modelRequestId: flags.requestId,
      needFullContent: flags.full || undefined,
      statusCodeTypes: flags.statusCode ? parseCommaList(flags.statusCode) : undefined,
    };

    if (settings.dryRun) {
      emitResult(
        {
          api: LIST_LOGS_API,
          data: { reqDTO },
          ...effectiveConsoleGatewayConfig(settings),
        },
        format,
      );
      return;
    }

    const resp = await pollTelemetryData(ctx.client, LIST_LOGS_API, reqDTO);
    const list = (resp.list as ModelLogEntry[]) ?? [];
    const nextToken = resp.nextToken as string | undefined;

    if (format === "json") {
      emitResult(
        {
          totalCount: resp.totalCount ?? 0,
          nextToken,
          list,
        },
        format,
      );
      return;
    }

    printLogTable(list);
    if (nextToken) {
      process.stdout.write(`Next page: --next-token ${nextToken}\n`);
    }
  },
});
