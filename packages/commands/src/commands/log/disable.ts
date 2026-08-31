import { defineCommand, detectOutputFormat, effectiveConsoleGatewayConfig } from "bailian-cli-core";
import { emitResult } from "bailian-cli-runtime";

const DISABLE_GROUP_API = "zeldaEasy.bailian-telemetry.telemetryGroup.disableTelemetryGroup";

export default defineCommand({
  description: {
    "en-US": "Disable inference log delivery for all models in the workspace",
    "zh-CN": "关闭当前业务空间全部模型的推理日志投递",
  },
  auth: "console",
  usageArgs: "[flags]",
  notes: [
    {
      "en-US": "Audit logs stay on; only the inference log (request/response content) is disabled.",
      "zh-CN": "仅关闭推理日志（请求/响应内容），审计日志保持开启。",
    },
  ],
  exampleArgs: ["", "--dry-run", "--output json"],
  async run(ctx) {
    const { settings } = ctx;
    const format = detectOutputFormat(settings.output);

    const reqDTO = {
      ...(settings.workspaceId
        ? { workspaceId: settings.workspaceId, filterWorkspaceId: settings.workspaceId }
        : {}),
      resourceId: "all",
      resourceType: "model",
      telemetryType: "InferenceLog",
    };

    if (settings.dryRun) {
      emitResult(
        {
          api: DISABLE_GROUP_API,
          data: { reqDTO },
          ...effectiveConsoleGatewayConfig(settings),
        },
        format,
      );
      return;
    }

    await ctx.client.console(DISABLE_GROUP_API, { reqDTO });

    if (format === "json") {
      emitResult({ disabled: true }, format);
      return;
    }

    process.stdout.write("Inference log delivery disabled.\n");
  },
});
