# `bl log` commands

> Auto-generated from `packages/cli/src/commands.ts`. Do not edit by hand.
> Regenerate: `pnpm --filter bailian-cli run generate:reference`.

Index: [index.md](index.md)

## Commands in this group

| Command              | Authentication | Description                                                                          |
| -------------------- | -------------- | ------------------------------------------------------------------------------------ |
| `bl log count`       | Console        | Count model call logs in a time range (useful before exporting)                      |
| `bl log disable`     | Console        | Disable inference log delivery for all models in the workspace                       |
| `bl log enable`      | Console        | Enable inference log delivery to SLS (SLR authorization → SLS instance → log switch) |
| `bl log get`         | Console        | Show a single call log with full request/response content                            |
| `bl log list`        | Console        | Query model call logs (audit trail; use --full for request/response content)         |
| `bl log status`      | Console        | Show model log delivery status (SLS authorization, audit / inference log)            |
| `bl log trace get`   | Console        | Show a single call trace with its span tree                                          |
| `bl log trace list`  | Console        | List call traces for a model or app                                                  |
| `bl log trace stats` | Console        | Show per-resource trace statistics (calls, tokens, latency)                          |

## Command details

### `bl log count`

| Field              | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Name**           | `log count`                                                     |
| **Description**    | Count model call logs in a time range (useful before exporting) |
| **Authentication** | Console                                                         |
| **Usage**          | `bl log count [--model <model>] [--hours <n>] [flags]`          |

#### Flags

| Flag                              | Type   | Required | Description                                              |
| --------------------------------- | ------ | -------- | -------------------------------------------------------- |
| `--hours <hours>`                 | number | no       | Hours to look back (default: 1)                          |
| `--start-time <time>`             | string | no       | Range start (ISO date or ms epoch); overrides --days     |
| `--end-time <time>`               | string | no       | Range end (ISO date or ms epoch); default: now           |
| `--model <model>`                 | string | no       | Model name(s), comma-separated                           |
| `--api-key-id <id>`               | string | no       | API key ID(s), comma-separated                           |
| `--channel <channel>`             | string | no       | Call channel(s), comma-separated                         |
| `--source <source>`               | string | no       | Call source(s), comma-separated                          |
| `--call-source <Online\|Offline>` | string | no       | Inference type: Online, Offline                          |
| `--console-region <region>`       | string | no       | Console gateway region (e.g. cn-beijing, ap-southeast-1) |
| `--console-site <site>`           | string | no       | Console site: domestic, international                    |
| `--console-switch-agent <uid>`    | number | no       | Switch agent UID for delegated access                    |
| `--workspace-id <id>`             | string | no       | Workspace ID (env: BAILIAN_WORKSPACE_ID)                 |

#### Examples

```bash
bl log count
```

```bash
bl log count --model qwen3.6-plus --hours 24
```

```bash
bl log count --output json
```

### `bl log disable`

| Field              | Value                                                          |
| ------------------ | -------------------------------------------------------------- |
| **Name**           | `log disable`                                                  |
| **Description**    | Disable inference log delivery for all models in the workspace |
| **Authentication** | Console                                                        |
| **Usage**          | `bl log disable [flags]`                                       |

#### Flags

| Flag                           | Type   | Required | Description                                              |
| ------------------------------ | ------ | -------- | -------------------------------------------------------- |
| `--console-region <region>`    | string | no       | Console gateway region (e.g. cn-beijing, ap-southeast-1) |
| `--console-site <site>`        | string | no       | Console site: domestic, international                    |
| `--console-switch-agent <uid>` | number | no       | Switch agent UID for delegated access                    |
| `--workspace-id <id>`          | string | no       | Workspace ID (env: BAILIAN_WORKSPACE_ID)                 |

#### Notes

- Audit logs stay on; only the inference log (request/response content) is disabled.

#### Examples

```bash
bl log disable
```

```bash
bl log disable --dry-run
```

```bash
bl log disable --output json
```

### `bl log enable`

| Field              | Value                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| **Name**           | `log enable`                                                                         |
| **Description**    | Enable inference log delivery to SLS (SLR authorization → SLS instance → log switch) |
| **Authentication** | Console                                                                              |
| **Usage**          | `bl log enable [--no-wait] [flags]`                                                  |

#### Flags

| Flag                           | Type   | Required | Description                                                         |
| ------------------------------ | ------ | -------- | ------------------------------------------------------------------- |
| `--no-wait`                    | switch | no       | Return right after submitting, without waiting for the SLS instance |
| `--console-region <region>`    | string | no       | Console gateway region (e.g. cn-beijing, ap-southeast-1)            |
| `--console-site <site>`        | string | no       | Console site: domestic, international                               |
| `--console-switch-agent <uid>` | number | no       | Switch agent UID for delegated access                               |
| `--workspace-id <id>`          | string | no       | Workspace ID (env: BAILIAN_WORKSPACE_ID)                            |

#### Notes

- Steps: 1) authorize the SLS service-linked role, 2) initialize the SLS store instance (async), 3) turn on inference log delivery for all models in the workspace.

#### Examples

```bash
bl log enable
```

```bash
bl log enable --no-wait
```

```bash
bl log enable --output json
```

### `bl log get`

| Field              | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| **Name**           | `log get`                                                 |
| **Description**    | Show a single call log with full request/response content |
| **Authentication** | Console                                                   |
| **Usage**          | `bl log get --request-id <id> [flags]`                    |

#### Flags

| Flag                           | Type   | Required | Description                                              |
| ------------------------------ | ------ | -------- | -------------------------------------------------------- |
| `--hours <hours>`              | number | no       | Hours to look back (default: 1)                          |
| `--start-time <time>`          | string | no       | Range start (ISO date or ms epoch); overrides --days     |
| `--end-time <time>`            | string | no       | Range end (ISO date or ms epoch); default: now           |
| `--request-id <id>`            | string | yes      | Model request ID (from `log list`)                       |
| `--model <model>`              | string | no       | Model name (narrows the search)                          |
| `--console-region <region>`    | string | no       | Console gateway region (e.g. cn-beijing, ap-southeast-1) |
| `--console-site <site>`        | string | no       | Console site: domestic, international                    |
| `--console-switch-agent <uid>` | number | no       | Switch agent UID for delegated access                    |
| `--workspace-id <id>`          | string | no       | Workspace ID (env: BAILIAN_WORKSPACE_ID)                 |

#### Examples

```bash
bl log get --request-id 6f6b2f1e-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

```bash
bl log get --request-id 6f6b2f1e-xxxx-xxxx-xxxx-xxxxxxxxxxxx --hours 24
```

```bash
bl log get --request-id 6f6b2f1e-xxxx-xxxx-xxxx-xxxxxxxxxxxx --output json
```

### `bl log list`

| Field              | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| **Name**           | `log list`                                                                   |
| **Description**    | Query model call logs (audit trail; use --full for request/response content) |
| **Authentication** | Console                                                                      |
| **Usage**          | `bl log list [--model <model>] [--hours <n>] [flags]`                        |

#### Flags

| Flag                              | Type   | Required | Description                                                                    |
| --------------------------------- | ------ | -------- | ------------------------------------------------------------------------------ |
| `--hours <hours>`                 | number | no       | Hours to look back (default: 1)                                                |
| `--start-time <time>`             | string | no       | Range start (ISO date or ms epoch); overrides --days                           |
| `--end-time <time>`               | string | no       | Range end (ISO date or ms epoch); default: now                                 |
| `--model <model>`                 | string | no       | Model name(s), comma-separated                                                 |
| `--api-key-id <id>`               | string | no       | API key ID(s), comma-separated                                                 |
| `--channel <channel>`             | string | no       | Call channel(s), comma-separated                                               |
| `--source <source>`               | string | no       | Call source(s), comma-separated                                                |
| `--call-source <Online\|Offline>` | string | no       | Inference type: Online, Offline                                                |
| `--request-id <id>`               | string | no       | Exact model request ID                                                         |
| `--status-code <type>`            | string | no       | Status filter(s), comma-separated: SUCCESS, CLIENT_ERROR, SERVER_ERROR, CANCEL |
| `--full`                          | switch | no       | Include full request/response content (requires inference log delivery)        |
| `--max-results <n>`               | number | no       | Rows per page (default: 20)                                                    |
| `--skip <n>`                      | number | no       | Rows to skip (default: 0)                                                      |
| `--next-token <token>`            | string | no       | Pagination token from a previous response                                      |
| `--console-region <region>`       | string | no       | Console gateway region (e.g. cn-beijing, ap-southeast-1)                       |
| `--console-site <site>`           | string | no       | Console site: domestic, international                                          |
| `--console-switch-agent <uid>`    | number | no       | Switch agent UID for delegated access                                          |
| `--workspace-id <id>`             | string | no       | Workspace ID (env: BAILIAN_WORKSPACE_ID)                                       |

#### Examples

```bash
bl log list
```

```bash
bl log list --model qwen3.6-plus --hours 3
```

```bash
bl log list --status-code SERVER_ERROR,CLIENT_ERROR
```

```bash
bl log list --request-id 6f6b2f1e-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

```bash
bl log list --full --model qwen3.6-plus --output json
```

### `bl log status`

| Field              | Value                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| **Name**           | `log status`                                                              |
| **Description**    | Show model log delivery status (SLS authorization, audit / inference log) |
| **Authentication** | Console                                                                   |
| **Usage**          | `bl log status [flags]`                                                   |

#### Flags

| Flag                           | Type   | Required | Description                                              |
| ------------------------------ | ------ | -------- | -------------------------------------------------------- |
| `--console-region <region>`    | string | no       | Console gateway region (e.g. cn-beijing, ap-southeast-1) |
| `--console-site <site>`        | string | no       | Console site: domestic, international                    |
| `--console-switch-agent <uid>` | number | no       | Switch agent UID for delegated access                    |
| `--workspace-id <id>`          | string | no       | Workspace ID (env: BAILIAN_WORKSPACE_ID)                 |

#### Examples

```bash
bl log status
```

```bash
bl log status --output json
```

### `bl log trace get`

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| **Name**           | `log trace get`                             |
| **Description**    | Show a single call trace with its span tree |
| **Authentication** | Console                                     |
| **Usage**          | `bl log trace get --trace-id <id> [flags]`  |

#### Flags

| Flag                           | Type   | Required | Description                                              |
| ------------------------------ | ------ | -------- | -------------------------------------------------------- |
| `--hours <hours>`              | number | no       | Hours to look back (default: 1)                          |
| `--start-time <time>`          | string | no       | Range start (ISO date or ms epoch); overrides --days     |
| `--end-time <time>`            | string | no       | Range end (ISO date or ms epoch); default: now           |
| `--trace-id <id>`              | string | yes      | Trace ID (from `log trace list`)                         |
| `--resource-id <id>`           | string | no       | Model name or app ID (narrows the search)                |
| `--console-region <region>`    | string | no       | Console gateway region (e.g. cn-beijing, ap-southeast-1) |
| `--console-site <site>`        | string | no       | Console site: domestic, international                    |
| `--console-switch-agent <uid>` | number | no       | Switch agent UID for delegated access                    |
| `--workspace-id <id>`          | string | no       | Workspace ID (env: BAILIAN_WORKSPACE_ID)                 |

#### Examples

```bash
bl log trace get --trace-id 0a1b2c3d4e5f --hours 24
```

```bash
bl log trace get --trace-id 0a1b2c3d4e5f --resource-id qwen3.6-plus
```

```bash
bl log trace get --trace-id 0a1b2c3d4e5f --output json
```

### `bl log trace list`

| Field              | Value                                          |
| ------------------ | ---------------------------------------------- |
| **Name**           | `log trace list`                               |
| **Description**    | List call traces for a model or app            |
| **Authentication** | Console                                        |
| **Usage**          | `bl log trace list --resource-id <id> [flags]` |

#### Flags

| Flag                           | Type   | Required | Description                                              |
| ------------------------------ | ------ | -------- | -------------------------------------------------------- |
| `--hours <hours>`              | number | no       | Hours to look back (default: 1)                          |
| `--start-time <time>`          | string | no       | Range start (ISO date or ms epoch); overrides --days     |
| `--end-time <time>`            | string | no       | Range end (ISO date or ms epoch); default: now           |
| `--resource-id <id>`           | string | yes      | Model name or app ID to query traces for                 |
| `--resource-type <model\|app>` | string | no       | Resource type: model, app (default: model)               |
| `--max-results <n>`            | number | no       | Rows per page (default: 20)                              |
| `--skip <n>`                   | number | no       | Rows to skip (default: 0)                                |
| `--console-region <region>`    | string | no       | Console gateway region (e.g. cn-beijing, ap-southeast-1) |
| `--console-site <site>`        | string | no       | Console site: domestic, international                    |
| `--console-switch-agent <uid>` | number | no       | Switch agent UID for delegated access                    |
| `--workspace-id <id>`          | string | no       | Workspace ID (env: BAILIAN_WORKSPACE_ID)                 |

#### Examples

```bash
bl log trace list --resource-id qwen3.6-plus
```

```bash
bl log trace list --resource-id qwen3.6-plus --hours 24 --max-results 50
```

```bash
bl log trace list --resource-id 123456 --resource-type app --output json
```

### `bl log trace stats`

| Field              | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| **Name**           | `log trace stats`                                           |
| **Description**    | Show per-resource trace statistics (calls, tokens, latency) |
| **Authentication** | Console                                                     |
| **Usage**          | `bl log trace stats [--resource-id <id>] [flags]`           |

#### Flags

| Flag                           | Type   | Required | Description                                               |
| ------------------------------ | ------ | -------- | --------------------------------------------------------- |
| `--hours <hours>`              | number | no       | Hours to look back (default: 1)                           |
| `--start-time <time>`          | string | no       | Range start (ISO date or ms epoch); overrides --days      |
| `--end-time <time>`            | string | no       | Range end (ISO date or ms epoch); default: now            |
| `--resource-id <id>`           | string | no       | Model name(s) or app ID(s), comma-separated; omit for all |
| `--resource-type <model\|app>` | string | no       | Resource type: model, app (default: model)                |
| `--console-region <region>`    | string | no       | Console gateway region (e.g. cn-beijing, ap-southeast-1)  |
| `--console-site <site>`        | string | no       | Console site: domestic, international                     |
| `--console-switch-agent <uid>` | number | no       | Switch agent UID for delegated access                     |
| `--workspace-id <id>`          | string | no       | Workspace ID (env: BAILIAN_WORKSPACE_ID)                  |

#### Examples

```bash
bl log trace stats
```

```bash
bl log trace stats --resource-id qwen3.6-plus --hours 24
```

```bash
bl log trace stats --resource-type app --output json
```
