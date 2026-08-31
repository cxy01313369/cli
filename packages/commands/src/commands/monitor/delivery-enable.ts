import { defineCommand, detectOutputFormat, effectiveConsoleGatewayConfig } from "bailian-cli-core";
import { ansi, emitResult } from "bailian-cli-runtime";
import {
  getTelemetryServiceStatus,
  TELEMETRY_SERVICE_STATUS_API,
  type TelemetryServiceStatus,
} from "../shared/telemetry.ts";

const INIT_CMS_API = "zeldaEasy.bailian-telemetry.activate.initCmsService";
const SERVICE_TYPE = "ModelMonitor";

const WAIT_INTERVAL_MS = 3000;
const WAIT_TIMEOUT_MS = 120_000;

async function waitForReady(
  client: Parameters<typeof getTelemetryServiceStatus>[0],
  workspaceId: string | undefined,
): Promise<TelemetryServiceStatus> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let status = await getTelemetryServiceStatus(client, SERVICE_TYPE, workspaceId);
  while (Date.now() < deadline) {
    if (status.openStatus && status.instanceStatus === "Ready") return status;
    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
    status = await getTelemetryServiceStatus(client, SERVICE_TYPE, workspaceId);
  }
  return status;
}

export default defineCommand({
  description: {
    "en-US":
      "Activate monitoring delivery: initializes the CMS service and dedicated Prometheus instance",
    "zh-CN": "开通监控数据投递：初始化 CMS 服务与用户独享 Prometheus 实例",
  },
  auth: "console",
  usageArgs: "[--no-wait] [flags]",
  flags: {
    noWait: {
      type: "switch",
      description: {
        "en-US": "Submit the activation request and return without waiting for Ready",
        "zh-CN": "提交开通请求后直接返回，不等待实例就绪",
      },
    },
  },
  notes: [
    {
      "en-US":
        "Activation is asynchronous: the request is accepted first, then the Prometheus instance becomes Ready in the background. Server-side throttles duplicate submissions within 30s.",
      "zh-CN":
        "开通是异步过程：请求先被受理，Prometheus 实例随后在后台就绪。服务端对 30 秒内的重复提交做节流。",
    },
  ],
  exampleArgs: ["", "--no-wait", "--output json"],
  async run(ctx) {
    const { settings, flags } = ctx;
    const format = detectOutputFormat(settings.output);
    const color = ansi(process.stderr);

    if (settings.dryRun) {
      emitResult(
        {
          apis: [TELEMETRY_SERVICE_STATUS_API, INIT_CMS_API],
          data: { reqDTO: { workspaceId: settings.workspaceId, slrType: "Cms" } },
          ...effectiveConsoleGatewayConfig(settings),
        },
        format,
      );
      return;
    }

    const before = await getTelemetryServiceStatus(ctx.client, SERVICE_TYPE, settings.workspaceId);
    if (before.openStatus && before.instanceStatus === "Ready") {
      if (format === "json") {
        emitResult({ activated: true, alreadyActive: true, ...before }, format);
      } else {
        process.stdout.write("Monitoring delivery is already active.\n");
      }
      return;
    }

    await ctx.client.console(INIT_CMS_API, {
      reqDTO: {
        ...(settings.workspaceId ? { workspaceId: settings.workspaceId } : {}),
        slrType: "Cms",
      },
    });

    if (flags.noWait) {
      const result = { activated: false, submitted: true };
      if (format === "json") {
        emitResult(result, format);
      } else {
        process.stdout.write(
          `Activation submitted. Run \`${ctx.identity.binName} monitor delivery status\` to check progress.\n`,
        );
      }
      return;
    }

    process.stderr.write(color.dim("Waiting for the Prometheus instance to become ready...\n"));
    const after = await waitForReady(ctx.client, settings.workspaceId);

    const ready = after.openStatus && after.instanceStatus === "Ready";
    if (format === "json") {
      emitResult({ activated: ready, ...after }, format);
      return;
    }
    if (ready) {
      process.stdout.write("Monitoring delivery is active.\n");
      if (after.instanceInfo) {
        process.stdout.write(`Instance: ${after.instanceInfo.instanceId}\n`);
        process.stdout.write(`URL: ${after.instanceInfo.instanceUrl}\n`);
      }
    } else {
      process.stdout.write(
        `Activation is still in progress. Run \`${ctx.identity.binName} monitor delivery status\` to check later.\n`,
      );
    }
  },
});
