import { describe, expect, test } from "vite-plus/test";
import { parseStdoutJson, runCommandE2e } from "./helpers.ts";
import { LOG_ROUTES } from "./topic-routes.ts";

// 只覆盖 help / 参数校验 / dry-run；真实调用依赖 console 凭证与已开启的日志投递。
describe("e2e: log", () => {
  test("log list --help 正常退出", async () => {
    const { stderr, exitCode } = await runCommandE2e(LOG_ROUTES, ["log", "list", "--help"]);
    expect(exitCode, stderr).toBe(0);
    expect(stderr).toContain("--model");
    expect(stderr).toContain("--hours");
    expect(stderr).toContain("--status-code");
    expect(stderr).toContain("--full");
  });

  test("log list 非法状态码类型报错", async () => {
    const { stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "list",
      "--status-code",
      "2xx",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("Unknown status code type");
  });

  test("log list --dry-run 输出查询参数", async () => {
    const { stdout, stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "list",
      "--model",
      "qwen3.6-plus",
      "--status-code",
      "SERVER_ERROR",
      "--full",
      "--dry-run",
      "--output",
      "json",
    ]);
    expect(exitCode, stderr).toBe(0);
    const data = parseStdoutJson<{
      api?: string;
      data?: {
        reqDTO?: {
          models?: string[];
          statusCodeTypes?: string[];
          needFullContent?: boolean;
        };
      };
    }>(stdout);
    expect(data.api).toBe("zeldaEasy.bailian-telemetry.platform-model.listModelLogs");
    expect(data.data?.reqDTO?.models).toEqual(["qwen3.6-plus"]);
    expect(data.data?.reqDTO?.statusCodeTypes).toEqual(["SERVER_ERROR"]);
    expect(data.data?.reqDTO?.needFullContent).toBe(true);
  });

  test("log get 缺少 --request-id 报错", async () => {
    const { stderr, exitCode } = await runCommandE2e(LOG_ROUTES, ["log", "get", "--hours", "2"]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--request-id");
  });

  test("log get --request-id 长度非法报错", async () => {
    const { stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "get",
      "--request-id",
      "short",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--request-id must be 32-36 characters");
  });

  test("log count --dry-run 输出计数 API", async () => {
    const { stdout, stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "count",
      "--hours",
      "24",
      "--dry-run",
      "--output",
      "json",
    ]);
    expect(exitCode, stderr).toBe(0);
    const data = parseStdoutJson<{ api?: string }>(stdout);
    expect(data.api).toBe("zeldaEasy.bailian-telemetry.model.countModelLogs");
  });

  test("log enable --dry-run 输出三段开通链路", async () => {
    const { stdout, stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "enable",
      "--dry-run",
      "--output",
      "json",
    ]);
    expect(exitCode, stderr).toBe(0);
    const data = parseStdoutJson<{
      apis?: string[];
      data?: { reqDTO?: { telemetryType?: string; resourceId?: string } };
    }>(stdout);
    expect(data.apis).toContain("zeldaEasy.bailian-telemetry.activate.createTelemetrySlr");
    expect(data.apis).toContain("zeldaEasy.bailian-telemetry.activate.initTelemetryStoreInstance");
    expect(data.apis).toContain("zeldaEasy.bailian-telemetry.telemetryGroup.enableTelemetryGroup");
    expect(data.data?.reqDTO?.telemetryType).toBe("InferenceLog");
    expect(data.data?.reqDTO?.resourceId).toBe("all");
  });

  test("log disable --dry-run 输出关闭请求", async () => {
    const { stdout, stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "disable",
      "--dry-run",
      "--output",
      "json",
    ]);
    expect(exitCode, stderr).toBe(0);
    const data = parseStdoutJson<{
      api?: string;
      data?: { reqDTO?: { telemetryType?: string } };
    }>(stdout);
    expect(data.api).toBe("zeldaEasy.bailian-telemetry.telemetryGroup.disableTelemetryGroup");
    expect(data.data?.reqDTO?.telemetryType).toBe("InferenceLog");
  });

  test("log trace list 缺少 --resource-id 报错", async () => {
    const { stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "trace",
      "list",
      "--hours",
      "2",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--resource-id");
  });

  test("log trace list --dry-run 输出 trace 查询", async () => {
    const { stdout, stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "trace",
      "list",
      "--resource-id",
      "qwen3.6-plus",
      "--dry-run",
      "--output",
      "json",
    ]);
    expect(exitCode, stderr).toBe(0);
    const data = parseStdoutJson<{
      api?: string;
      data?: { reqDTO?: { resourceId?: string; resourceType?: string } };
    }>(stdout);
    expect(data.api).toBe("zeldaEasy.bailian-telemetry.trace.listTracesWithOss");
    expect(data.data?.reqDTO?.resourceId).toBe("qwen3.6-plus");
    expect(data.data?.reqDTO?.resourceType).toBe("model");
  });

  test("log trace get 缺少 --trace-id 报错", async () => {
    const { stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "trace",
      "get",
      "--hours",
      "2",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--trace-id");
  });

  test("log trace stats --dry-run 输出统计 API", async () => {
    const { stdout, stderr, exitCode } = await runCommandE2e(LOG_ROUTES, [
      "log",
      "trace",
      "stats",
      "--dry-run",
      "--output",
      "json",
    ]);
    expect(exitCode, stderr).toBe(0);
    const data = parseStdoutJson<{ api?: string }>(stdout);
    expect(data.api).toBe("zeldaEasy.bailian-telemetry.trace.getTraceStatistic");
  });
});
