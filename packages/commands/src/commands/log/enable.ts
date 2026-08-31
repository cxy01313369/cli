import { defineCommand, detectOutputFormat, effectiveConsoleGatewayConfig } from "bailian-cli-core";
import { ansi, emitResult } from "bailian-cli-runtime";
import {
  getTelemetryServiceStatus,
  pollTelemetryData,
  unwrapConsolePrimitive,
} from "../shared/telemetry.ts";
import { fetchLogServiceStatus, LOG_SERVICE_TYPES } from "./status.ts";

const CREATE_SLR_API = "zeldaEasy.bailian-telemetry.activate.createTelemetrySlr";
const INIT_STORE_API = "zeldaEasy.bailian-telemetry.activate.initTelemetryStoreInstance";
const ENABLE_GROUP_API = "zeldaEasy.bailian-telemetry.telemetryGroup.enableTelemetryGroup";

const WAIT_INTERVAL_MS = 3000;
const WAIT_TIMEOUT_MS = 180_000;

export default defineCommand({
  description: {
    "en-US": "Enable inference log delivery to SLS (SLR authorization → SLS instance → log switch)",
    "zh-CN": "开启推理日志投递到 SLS（SLR 授权 → SLS 实例初始化 → 打开日志开关）",
  },
  auth: "console",
  usageArgs: "[--no-wait] [flags]",
  flags: {
    noWait: {
      type: "switch",
      description: {
        "en-US": "Return right after submitting, without waiting for the SLS instance",
        "zh-CN": "提交后立即返回，不等待 SLS 实例就绪",
      },
    },
  },
  notes: [
    {
      "en-US":
        "Steps: 1) authorize the SLS service-linked role, 2) initialize the SLS store instance (async), 3) turn on inference log delivery for all models in the workspace.",
      "zh-CN":
        "开启链路：1）授权 SLS 服务关联角色；2）初始化 SLS 存储实例（异步）；3）为当前业务空间全部模型打开推理日志开关。",
    },
  ],
  exampleArgs: ["", "--no-wait", "--output json"],
  async run(ctx) {
    const { settings, flags, identity } = ctx;
    const format = detectOutputFormat(settings.output);
    const color = ansi(process.stderr);

    const groupReqDTO = {
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
          apis: [CREATE_SLR_API, INIT_STORE_API, ENABLE_GROUP_API],
          data: { reqDTO: groupReqDTO },
          ...effectiveConsoleGatewayConfig(settings),
        },
        format,
      );
      return;
    }

    // Step 1: SLS service-linked role.
    const before = await fetchLogServiceStatus(ctx.client, settings.workspaceId);
    if (!before.slrAuthorized) {
      process.stderr.write(color.dim("Authorizing the SLS service-linked role...\n"));
      const slrRaw = await ctx.client.console(CREATE_SLR_API, {
        reqDTO: {
          ...(settings.workspaceId ? { workspaceId: settings.workspaceId } : {}),
          slrType: "Log",
        },
      });
      if (unwrapConsolePrimitive<boolean>(slrRaw) !== true) {
        process.stderr.write(color.dim("SLR authorization submitted; continuing.\n"));
      }
    }

    // Step 2: SLS store instance (async creation, poll until Ready).
    let inferenceStatus = before.inference;
    if (inferenceStatus.instanceStatus === "NotExist" || !inferenceStatus.openStatus) {
      process.stderr.write(color.dim("Initializing the SLS store instance...\n"));
      await pollTelemetryData(ctx.client, INIT_STORE_API, {
        ...(settings.workspaceId ? { workspaceId: settings.workspaceId } : {}),
        serviceType: LOG_SERVICE_TYPES.inference,
      });

      if (!flags.noWait) {
        process.stderr.write(color.dim("Waiting for the SLS instance to become ready...\n"));
        const deadline = Date.now() + WAIT_TIMEOUT_MS;
        inferenceStatus = await getTelemetryServiceStatus(
          ctx.client,
          LOG_SERVICE_TYPES.inference,
          settings.workspaceId,
        );
        while (Date.now() < deadline && inferenceStatus.instanceStatus !== "Ready") {
          await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
          inferenceStatus = await getTelemetryServiceStatus(
            ctx.client,
            LOG_SERVICE_TYPES.inference,
            settings.workspaceId,
          );
        }
      }
    }

    // Step 3: turn on inference log delivery for all models.
    await ctx.client.console(ENABLE_GROUP_API, { reqDTO: groupReqDTO });

    if (format === "json") {
      emitResult({ enabled: true, instanceStatus: inferenceStatus.instanceStatus }, format);
      return;
    }

    process.stdout.write("Inference log delivery enabled.\n");
    if (flags.noWait) {
      process.stdout.write(
        `The SLS instance may still be initializing; check \`${identity.binName} log status\` later.\n`,
      );
    }
  },
});
