import {
  BailianError,
  ExitCode,
  UsageError,
  unwrapResponse,
  type Client,
  type FlagsDef,
} from "bailian-cli-core";
import { parseCommaList } from "./params.ts";

// ---------------------------------------------------------------------------
// Async task polling for the console gateway
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 500;
const DEFAULT_MAX_POLLS = 30;

/**
 * Poll a console API until it returns a terminal (non task-id) response.
 * The gateway answers an async request with a bare `{taskId}` envelope; the
 * caller re-issues with that id until real data arrives or the budget runs out.
 */
export async function pollConsoleUntilDone(
  client: Client,
  api: string,
  buildRequest: (taskId: string | undefined) => Record<string, unknown>,
  maxPolls = DEFAULT_MAX_POLLS,
): Promise<unknown> {
  let nextTaskId: string | undefined;

  for (let attempt = 0; attempt < maxPolls; attempt++) {
    const raw = await client.console(api, buildRequest(nextTaskId));
    const resp = unwrapResponse(raw as Record<string, unknown>);

    if (resp.taskId && Object.keys(resp).length === 1) {
      nextTaskId = resp.taskId as string;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }
    return raw;
  }
  return null;
}

/** Telemetry APIs wrap the payload in `reqDTO` and echo the task id as `asyncTaskId`. */
export async function pollTelemetryApi(
  client: Client,
  api: string,
  reqDTO: Record<string, unknown>,
): Promise<unknown> {
  return pollConsoleUntilDone(client, api, (taskId) =>
    taskId ? { reqDTO: { ...reqDTO, asyncTaskId: taskId } } : { reqDTO },
  );
}

/** Poll a telemetry API and unwrap the payload; throws TIMEOUT when the budget runs out. */
export async function pollTelemetryData(
  client: Client,
  api: string,
  reqDTO: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const raw = await pollTelemetryApi(client, api, reqDTO);
  if (!raw) {
    throw new BailianError("Request timed out.", ExitCode.TIMEOUT);
  }
  return unwrapResponse(raw as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Time range flags
// ---------------------------------------------------------------------------

/** Shared time-range flag definitions for telemetry read commands. */
export const TELEMETRY_TIME_FLAGS = {
  days: {
    type: "number",
    valueHint: "<days>",
    description: {
      "en-US": "Number of days to look back (default: 7)",
      "zh-CN": "向前查询的天数（默认：7）",
    },
  },
  startTime: {
    type: "string",
    valueHint: "<time>",
    description: {
      "en-US": "Range start (ISO date or ms epoch); overrides --days",
      "zh-CN": "开始时间（ISO 日期或毫秒时间戳），设置后覆盖 --days",
    },
  },
  endTime: {
    type: "string",
    valueHint: "<time>",
    description: {
      "en-US": "Range end (ISO date or ms epoch); default: now",
      "zh-CN": "结束时间（ISO 日期或毫秒时间戳），默认当前时间",
    },
  },
} satisfies FlagsDef;

/** Parse a time flag: ms epoch digits, or anything `Date.parse` accepts. */
function parseTimeFlag(value: string, flagName: string): number {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    throw new UsageError(`${flagName} must be an ISO date or a millisecond timestamp.`);
  }
  return parsed;
}

export interface TelemetryTimeRange {
  startTime: number;
  endTime: number;
}

/** Resolve --start-time/--end-time/--hours/--days into a millisecond range (end defaults to now). */
export function resolveTimeRange(
  flags: { days?: number; hours?: number; startTime?: string; endTime?: string },
  defaultDays = 7,
): TelemetryTimeRange {
  const endTime = flags.endTime ? parseTimeFlag(flags.endTime, "--end-time") : Date.now();
  const startTime = flags.startTime
    ? parseTimeFlag(flags.startTime, "--start-time")
    : flags.hours != null
      ? endTime - flags.hours * 3_600_000
      : endTime - (flags.days || defaultDays) * 86_400_000;
  if (startTime >= endTime) {
    throw new UsageError("--start-time must be earlier than --end-time.");
  }
  return { startTime, endTime };
}

/** Time flags for log commands: hour-based window, default 1 hour. */
export const TELEMETRY_LOG_TIME_FLAGS = {
  hours: {
    type: "number",
    valueHint: "<hours>",
    description: {
      "en-US": "Hours to look back (default: 1)",
      "zh-CN": "向前查询的小时数（默认：1）",
    },
  },
  startTime: TELEMETRY_TIME_FLAGS.startTime,
  endTime: TELEMETRY_TIME_FLAGS.endTime,
} satisfies FlagsDef;

/** Unwrap a console gateway response whose final payload is a primitive (boolean/number). */
export function unwrapConsolePrimitive<T>(raw: unknown): T {
  const resp = unwrapResponse(raw as Record<string, unknown>) as unknown;
  if (resp !== null && typeof resp === "object" && "result" in (resp as Record<string, unknown>)) {
    return (resp as Record<string, unknown>).result as T;
  }
  return resp as T;
}

/** Default step (seconds) for a range: finer for short ranges, coarser for long ones. */
export function autoStep(startTime: number, endTime: number): number {
  const hours = (endTime - startTime) / 3_600_000;
  if (hours <= 12) return 60;
  if (hours <= 24) return 120;
  if (hours <= 3 * 24) return 300;
  if (hours <= 7 * 24) return 900;
  return 1800;
}

// ---------------------------------------------------------------------------
// OSS fallback for large telemetry payloads
// ---------------------------------------------------------------------------

/**
 * `*WithOss` telemetry APIs return small payloads inline as `originData` and
 * large ones as a `dataDownloadUrl`; resolve both shapes to the payload.
 * The payload shape is API-specific (array or wrapper object) — the caller picks T.
 */
export async function resolveOssPayload<T>(resp: Record<string, unknown>): Promise<T | undefined> {
  const { originData, dataDownloadUrl } = resp as {
    originData?: T;
    dataDownloadUrl?: string;
  };
  if (originData !== undefined && originData !== null) return originData;
  if (dataDownloadUrl) {
    const res = await fetch(dataDownloadUrl.replace(/^http:\/\//, "https://"));
    if (!res.ok) {
      throw new BailianError(
        `Failed to download telemetry data (HTTP ${res.status}).`,
        ExitCode.NETWORK,
      );
    }
    return (await res.json()) as T;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Service activation preflight
// ---------------------------------------------------------------------------

export const TELEMETRY_SERVICE_STATUS_API =
  "zeldaEasy.bailian-telemetry.activate.getTelemetryServiceStatus";

export type TelemetryInstanceStatus = "NotExist" | "NotReady" | "Ready";

export interface TelemetryServiceStatus {
  openStatus: boolean;
  instanceStatus?: TelemetryInstanceStatus;
  openServiceUrl?: string;
  instanceInfo?: {
    instanceId: string;
    instanceUrl: string;
    instanceName?: string;
    regionName?: string;
    gmtCreate?: number;
  };
}

/** Query the activation status of a telemetry service (ModelMonitor / ModelLog / …). */
export async function getTelemetryServiceStatus(
  client: Client,
  serviceType: string,
  workspaceId?: string,
): Promise<TelemetryServiceStatus> {
  const resp = await pollTelemetryData(client, TELEMETRY_SERVICE_STATUS_API, {
    ...(workspaceId ? { workspaceId } : {}),
    serviceType,
  });
  return resp as unknown as TelemetryServiceStatus;
}

/**
 * Gate a read command on the telemetry service being active. "Not activated"
 * is a state the CLI can authoritatively explain (via the status API), so it
 * raises AUTH with a hint pointing at the matching enable command instead of
 * letting the read fail with an opaque server error.
 *
 * requireInstance: alert rules live on shared CMS, so openStatus alone is
 * enough; dedicated-Prometheus features need the instance to be Ready.
 */
export async function ensureTelemetryReady(
  client: Client,
  opts: {
    serviceType: string;
    workspaceId?: string;
    enableCommand: string;
    requireInstance?: boolean;
  },
): Promise<void> {
  const status = await getTelemetryServiceStatus(client, opts.serviceType, opts.workspaceId);
  const ready =
    opts.requireInstance === false
      ? status.openStatus
      : status.openStatus && status.instanceStatus === "Ready";
  if (ready) return;
  throw new BailianError(
    "The monitoring service is not activated yet.",
    ExitCode.AUTH,
    `Run \`${opts.enableCommand}\` to activate it, or enable it in the Bailian console.`,
  );
}

// ---------------------------------------------------------------------------
// Shared monitor filter flags
// ---------------------------------------------------------------------------

/** Common filter flags shared by monitor/log read commands. */
export const TELEMETRY_FILTER_FLAGS = {
  model: {
    type: "string",
    valueHint: "<model>",
    description: {
      "en-US": "Model name(s), comma-separated",
      "zh-CN": "模型名称，多个名称以逗号分隔",
    },
  },
  apiKeyId: {
    type: "string",
    valueHint: "<id>",
    description: {
      "en-US": "API key ID(s), comma-separated",
      "zh-CN": "API Key ID，多个以逗号分隔",
    },
  },
  channel: {
    type: "string",
    valueHint: "<channel>",
    description: {
      "en-US": "Call channel(s), comma-separated",
      "zh-CN": "调用渠道，多个以逗号分隔",
    },
  },
  source: {
    type: "string",
    valueHint: "<source>",
    description: {
      "en-US": "Call source(s), comma-separated",
      "zh-CN": "调用来源，多个以逗号分隔",
    },
  },
  callSource: {
    type: "string",
    valueHint: "<type>",
    choices: ["Online", "Offline"] as const,
    description: {
      "en-US": "Inference type: Online, Offline",
      "zh-CN": "推理类型：Online、Offline",
    },
  },
} satisfies FlagsDef;

export interface TelemetryFilterFlags {
  model?: string;
  apiKeyId?: string;
  channel?: string;
  source?: string;
  callSource?: "Online" | "Offline";
}

function splitDefined(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = parseCommaList(value);
  return items.length ? items : undefined;
}

/** Map CLI filter flags to the platform-model reqDTO filter fields. */
export function buildTelemetryFilters(
  flags: TelemetryFilterFlags,
  workspaceId?: string,
): Record<string, unknown> {
  return {
    ...(workspaceId ? { workspaceId } : {}),
    models: splitDefined(flags.model),
    apikeyIds: splitDefined(flags.apiKeyId),
    channels: splitDefined(flags.channel),
    sources: splitDefined(flags.source),
    modelCallSource: flags.callSource,
  };
}
