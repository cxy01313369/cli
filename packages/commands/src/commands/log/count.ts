import { defineCommand, detectOutputFormat, effectiveConsoleGatewayConfig } from "bailian-cli-core";
import { emitResult } from "bailian-cli-runtime";
import { formatNumber, formatDateTime } from "../shared/format.ts";
import {
  TELEMETRY_LOG_TIME_FLAGS,
  TELEMETRY_FILTER_FLAGS,
  buildTelemetryFilters,
  resolveTimeRange,
  unwrapConsolePrimitive,
} from "../shared/telemetry.ts";

const COUNT_LOGS_API = "zeldaEasy.bailian-telemetry.model.countModelLogs";

export default defineCommand({
  description: {
    "en-US": "Count model call logs in a time range (useful before exporting)",
    "zh-CN": "统计时间范围内的模型调用日志条数（导出前预估量级）",
  },
  auth: "console",
  usageArgs: "[--model <model>] [--hours <n>] [flags]",
  flags: {
    ...TELEMETRY_LOG_TIME_FLAGS,
    ...TELEMETRY_FILTER_FLAGS,
  },
  exampleArgs: ["", "--model qwen3.6-plus --hours 24", "--output json"],
  async run(ctx) {
    const { settings, flags } = ctx;
    const format = detectOutputFormat(settings.output);
    const { startTime, endTime } = resolveTimeRange(flags, 1 / 24);

    const reqDTO = {
      ...buildTelemetryFilters(flags, settings.workspaceId),
      filterWorkspaceId: settings.workspaceId,
      startTime,
      endTime,
    };

    if (settings.dryRun) {
      emitResult(
        {
          api: COUNT_LOGS_API,
          data: { reqDTO },
          ...effectiveConsoleGatewayConfig(settings),
        },
        format,
      );
      return;
    }

    const raw = await ctx.client.console(COUNT_LOGS_API, { reqDTO });
    const count = unwrapConsolePrimitive<number>(raw);

    if (format === "json") {
      emitResult(
        {
          period: { start: formatDateTime(startTime), end: formatDateTime(endTime) },
          count,
        },
        format,
      );
      return;
    }

    process.stdout.write(
      `Logs: ${formatNumber(count)}  (${formatDateTime(startTime)} ~ ${formatDateTime(endTime)})\n`,
    );
  },
});
