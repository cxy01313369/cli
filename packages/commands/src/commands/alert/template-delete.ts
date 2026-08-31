import {
  defineCommand,
  detectOutputFormat,
  effectiveConsoleGatewayConfig,
  unwrapResponse,
} from "bailian-cli-core";
import { emitResult, confirmDangerousAction } from "bailian-cli-runtime";
import { parseCommaList } from "../shared/params.ts";
import { ensureAlertReady } from "./shared.ts";

const DELETE_TEMPLATES_API = "zeldaEasy.bailian-telemetry.alertTemplate.deleteAlertTemplates";

export default defineCommand({
  description: {
    "en-US": "Delete custom alert templates (official templates cannot be deleted)",
    "zh-CN": "删除自定义告警模板（官方模板不可删除）",
  },
  auth: "console",
  usageArgs: "--template-id <id>[,<id>...] [--yes]",
  flags: {
    templateId: {
      type: "string",
      valueHint: "<id>[,<id>...]",
      required: true,
      description: {
        "en-US": "Template ID(s) to delete, comma-separated",
        "zh-CN": "要删除的模板 ID，多个以逗号分隔",
      },
    },
    yes: {
      type: "switch",
      description: { "en-US": "Skip the confirmation prompt", "zh-CN": "跳过确认提示" },
    },
  },
  exampleArgs: ["--template-id 123", "--template-id 123,124 --dry-run", "--template-id 123 --yes"],
  notes: [
    {
      "en-US": "Irreversible — the alert templates are permanently removed.",
      "zh-CN": "该操作不可撤销——告警模板将被永久删除。",
    },
  ],
  async run(ctx) {
    const { settings, flags } = ctx;
    const format = detectOutputFormat(settings.output);

    const reqDTO = { templateIds: parseCommaList(flags.templateId) };

    if (settings.dryRun) {
      emitResult(
        {
          api: DELETE_TEMPLATES_API,
          data: { reqDTO },
          ...effectiveConsoleGatewayConfig(settings),
        },
        format,
      );
      return;
    }

    await confirmDangerousAction(
      `Delete ${reqDTO.templateIds.length} alert template(s): ${reqDTO.templateIds.join(", ")}.\nThe templates are permanently removed. This cannot be undone.`,
      flags.yes ?? false,
    );

    await ensureAlertReady(ctx.client, settings.workspaceId, ctx.identity.binName);

    const raw = await ctx.client.console(DELETE_TEMPLATES_API, { reqDTO });
    const resp = unwrapResponse(raw as Record<string, unknown>);

    if (format === "json") {
      emitResult({ deleted: reqDTO.templateIds, result: resp }, format);
      return;
    }

    process.stdout.write(`Deleted ${reqDTO.templateIds.length} alert template(s).\n`);
  },
});
