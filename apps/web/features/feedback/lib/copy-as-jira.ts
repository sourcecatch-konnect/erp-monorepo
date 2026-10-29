import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_IMPACT_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "@skerp/validators";
import {
  describeUserAgent,
  formatFeedbackNumber,
  formatVoiceDuration,
  legacyDetailRows,
  type FeedbackDetail,
} from "@skerp/types";

/** Markdown that pastes cleanly into a Jira Cloud description. */
export function feedbackAsJira(item: FeedbackDetail, link: string): string {
  const lines = [
    `**${formatFeedbackNumber(item.number)} · ${FEEDBACK_CATEGORY_LABELS[item.category]} · ${
      FEEDBACK_IMPACT_LABELS[item.impact]
    } impact · ${FEEDBACK_STATUS_LABELS[item.status]}**`,
    "",
    `**Summary:** ${item.title}`,
    `**Page:** ${item.pageTitle} (${item.moduleLabel}) — \`${item.pagePath}\``,
    ...(item.section ? [`**Section:** ${item.section}`] : []),
    `**Reported by:** ${item.reporterName} (${item.reporterRole}${
      item.reporterBranch ? `, ${item.reporterBranch}` : ""
    }) on ${new Date(item.createdAt).toLocaleString("en-IN")}`,
  ];

  if (item.description) lines.push("", item.description);
  if (item.points.length > 0) {
    lines.push("", "**Points:**", ...item.points.map((point) => `- ${point}`));
  }
  const oldAnswers = legacyDetailRows(item.details);
  if (oldAnswers.length > 0) {
    lines.push("", ...oldAnswers.map(([label, value]) => `**${label}:** ${value}`));
  }

  const attachments = [
    ...(item.voiceSeconds ? [`Voice note (${formatVoiceDuration(item.voiceSeconds)})`] : []),
    ...(item.imageCount > 0
      ? [`${item.imageCount} picture${item.imageCount === 1 ? "" : "s"}`]
      : []),
    ...item.files.filter((file) => file.kind === "document").map((file) => file.name),
  ];
  if (attachments.length > 0) {
    lines.push("", `**Attached (open the link to see them):** ${attachments.join(", ")}`);
  }

  lines.push(
    "",
    `**Environment:** ${describeUserAgent(item.context.userAgent)}, app version ${
      item.context.appVersion ?? "not set"
    }, screen ${item.context.viewport ?? "?"}`,
  );

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
