import { defineCommand, detectOutputFormat } from "bailian-cli-core";
import { ansi, emitResult, displayWidth, padEnd } from "bailian-cli-runtime";
import {
  getTelemetryServiceStatus,
  unwrapConsolePrimitive,
  type TelemetryServiceStatus,
} from "../shared/telemetry.ts";

const SLR_STATUS_API = "zeldaEasy.bailian-telemetry.activate.getTelemetrySlrStatus";

export const LOG_SERVICE_TYPES = {
  audit: "ModelAuditLog",
  inference: "ModelInferenceLog",
} as const;

export interface LogServiceStatus {
  slrAuthorized: boolean;
  audit: TelemetryServiceStatus;
  inference: TelemetryServiceStatus;
}

export async function fetchLogServiceStatus(
  client: Parameters<typeof getTelemetryServiceStatus>[0],
  workspaceId?: string,
): Promise<LogServiceStatus> {
  const slrRaw = await client.console(SLR_STATUS_API, {
    reqDTO: { ...(workspaceId ? { workspaceId } : {}), slrType: "Log" },
  });
  const slrAuthorized = unwrapConsolePrimitive<boolean>(slrRaw) === true;

  const audit = await getTelemetryServiceStatus(client, LOG_SERVICE_TYPES.audit, workspaceId);
  const inference = await getTelemetryServiceStatus(
    client,
    LOG_SERVICE_TYPES.inference,
    workspaceId,
  );

  return { slrAuthorized, audit, inference };
}

function statusText(status: TelemetryServiceStatus): string {
  if (!status.openStatus) return "Not activated";
  return status.instanceStatus ?? "-";
}

export default defineCommand({
  description: {
    "en-US": "Show model log delivery status (SLS authorization, audit / inference log)",
    "zh-CN": "查看模型日志投递状态（SLS 授权、审计日志 / 推理日志）",
  },
  auth: "console",
  usageArgs: "[flags]",
  exampleArgs: ["", "--output json"],
  async run(ctx) {
    const { settings, identity } = ctx;
    const format = detectOutputFormat(settings.output);

    const status = await fetchLogServiceStatus(ctx.client, settings.workspaceId);

    if (format === "json") {
      emitResult(status, format);
      return;
    }

    const color = ansi(process.stdout);
    const rows: [string, string][] = [
      ["SLS Authorization (SLR)", status.slrAuthorized ? "Authorized" : "Not authorized"],
      ["Audit Log", statusText(status.audit)],
      ["Inference Log", statusText(status.inference)],
    ];
    const instanceUrl = status.inference.instanceInfo?.instanceUrl;
    if (instanceUrl) rows.push(["SLS Instance URL", instanceUrl]);

    const maxLabel = Math.max(...rows.map(([label]) => displayWidth(label)));
    for (const [label, value] of rows) {
      process.stdout.write(`${color.bold(padEnd(label, maxLabel + 2))}${value}\n`);
    }

    if (!status.inference.openStatus) {
      process.stdout.write(
        color.dim(`\nRun \`${identity.binName} log enable\` to enable inference log delivery.\n`),
      );
    }
  },
});
