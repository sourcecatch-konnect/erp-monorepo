import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_DETAIL_FIELDS,
  FEEDBACK_SEVERITY_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "@skerp/validators";
import {
  describeUserAgent,
  formatFeedbackNumber,
  type FeedbackDetail,
} from "@skerp/types";

/** Detail answers as [label, readable value] pairs, in display order. */
export function detailRows(item: FeedbackDetail): [string, string][] {
  const rows: [string, string][] = [];
  for (const field of FEEDBACK_DETAIL_FIELDS[item.category]) {
    const raw = item.details[field.key];
    if (!raw) continue;
    const choices: Record<string, string> | undefined =
      "choices" in field ? field.choices : undefined;
    rows.push([field.label, choices?.[raw] ?? raw]);
  }
  return rows;
}

/** Markdown that pastes cleanly into a Jira Cloud description. */
export function feedbackAsJira(item: FeedbackDetail, link: string): string {
  const lines = [
    `**${formatFeedbackNumber(item.number)} · ${FEEDBACK_CATEGORY_LABELS[item.category]}${
      item.severity ? ` · ${FEEDBACK_SEVERITY_LABELS[item.severity]}` : ""
    } · ${FEEDBACK_STATUS_LABELS[item.status]}**`,
    "",
    `**Summary:** ${item.title}`,
    `**Page:** ${item.pageTitle} (${item.moduleLabel}) — \`${item.pagePath}\``,
    `**Reported by:** ${item.reporterName} (${item.reporterRole}${
      item.reporterBranch ? `, ${item.reporterBranch}` : ""
    }) on ${new Date(item.createdAt).toLocaleString("en-IN")}`,
    "",
    ...detailRows(item).map(([label, value]) => `**${label}:** ${value}`),
    ...(item.description ? ["", `**Anything else:** ${item.description}`] : []),
    "",
    `**Environment:** ${describeUserAgent(item.context.userAgent)}, app version ${
      item.context.appVersion ?? "not set"
    }, screen ${item.context.viewport ?? "?"}`,
  ];

  const failures = (item.context.recentApi ?? []).filter(
    (call) => call.status === null || call.status >= 400,
  );
  if (failures.length > 0) {
    lines.push("", "**Recent API errors:**");
    for (const call of failures) {
      lines.push(
        `- ${call.method} ${call.url} → ${call.status ?? "no response"}${
          call.message ? ` — ${call.message}` : ""
        }`,
      );
    }
  }

  lines.push("", `Feedback link: ${link}`);
  return lines.join("\n");
}
