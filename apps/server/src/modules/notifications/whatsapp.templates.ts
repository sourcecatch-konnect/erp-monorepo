import { BadRequestError } from "../../lib/error.js";

/**
 * Thin wrapper around the Meta Graph API for WhatsApp message-template management
 * (create / edit / delete / list). Mirrors the fetch style used by the WhatsApp
 * sender in providers.ts. Used only by the notification admin routes.
 */

const apiBaseUrl = () => process.env.META_WHATSAPP_API_BASE_URL;
const wabaId = () => process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;

export const getManagementToken = () =>
  process.env.META_WHATSAPP_MANAGEMENT_TOKEN ||
  process.env.META_WHATSAPP_ACCESS_TOKEN;

export const isMetaConfigured = () =>
  Boolean(apiBaseUrl() && wabaId() && getManagementToken());

export type MetaTemplateStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DISABLED";

export type MetaTemplateListItem = {
  id?: string;
  name?: string;
  status?: string;
  category?: string;
  language?: string;
  rejected_reason?: string;
};

type MetaComponent =
  | {
      type: "BODY";
      text: string;
      example?: { body_text: string[][] };
    }
  | { type: "FOOTER"; text: string };

const requireConfig = () => {
  const base = apiBaseUrl();
  const id = wabaId();
  const token = getManagementToken();
  if (!base || !id || !token) {
    throw new BadRequestError(
      "Meta WhatsApp is not configured. Set META_WHATSAPP_API_BASE_URL, META_WHATSAPP_BUSINESS_ACCOUNT_ID and an access token."
    );
  }
  return { base, id, token };
};

const graphFetch = async (
  url: string,
  init: RequestInit,
  token: string
): Promise<Record<string, unknown>> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & Record<string, unknown>;

  if (!response.ok) {
    throw new BadRequestError(
      body.error?.message || `Meta Graph API request failed (${response.status})`
    );
  }

  return body;
};

/**
 * Convert a body authored with named tokens ({{orderNumber}}) into Meta's
 * positional form ({{1}}, {{2}}...). Repeated variables reuse the same index.
 * Throws if a token is not in the event's known variable list.
 */
export const buildPositionalBody = (
  body: string,
  allowedVariables: string[]
): { positionalBody: string; paramOrder: string[] } => {
  const paramOrder: string[] = [];
  const positionalBody = body.replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (_match, name: string) => {
      if (!allowedVariables.includes(name)) {
        throw new BadRequestError(
          `Unknown template variable "${name}". Allowed: ${
            allowedVariables.join(", ") || "(none)"
          }`
        );
      }
      let index = paramOrder.indexOf(name);
      if (index === -1) {
        paramOrder.push(name);
        index = paramOrder.length - 1;
      }
      return `{{${index + 1}}}`;
    }
  );
  return { positionalBody, paramOrder };
};

// Sample values used to satisfy Meta's example requirement for body variables.
const sampleValues: Record<string, string> = {
  title: "Order confirmed",
  message: "Your order has been confirmed.",
  orderNumber: "ORD-1024",
  lrNumber: "LR-5567",
  tripNumber: "TRIP-301",
  reason: "Pending POD",
  driverName: "Rahul Sharma",
  expiryDate: "2026-07-15",
  documentType: "Insurance",
  vehicleNumber: "MH12AB1234",
  ewaybillNo: "EWB-99887766",
  entityType: "Order",
  entityNumber: "ORD-1024",
};

const sampleFor = (variable: string) => sampleValues[variable] || "Sample";

const buildComponents = (
  positionalBody: string,
  paramOrder: string[],
  footer?: string | null
): MetaComponent[] => {
  const components: MetaComponent[] = [
    {
      type: "BODY",
      text: positionalBody,
      ...(paramOrder.length
        ? { example: { body_text: [paramOrder.map(sampleFor)] } }
        : {}),
    },
  ];
  if (footer && footer.trim()) {
    components.push({ type: "FOOTER", text: footer.trim() });
  }
  return components;
};

export type SubmitTemplateInput = {
  name: string;
  language: string;
  category: string;
  positionalBody: string;
  paramOrder: string[];
  footer?: string | null;
};

export const createMetaTemplate = async (
  input: SubmitTemplateInput
): Promise<{ id?: string; status?: string }> => {
  const { base, id, token } = requireConfig();
  const body = await graphFetch(
    `${base}/${id}/message_templates`,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        language: input.language,
        category: input.category,
        components: buildComponents(
          input.positionalBody,
          input.paramOrder,
          input.footer
        ),
      }),
    },
    token
  );
  return { id: body.id as string | undefined, status: body.status as string | undefined };
};

export const editMetaTemplate = async (
  metaTemplateId: string,
  input: Pick<SubmitTemplateInput, "category" | "positionalBody" | "paramOrder" | "footer">
): Promise<void> => {
  const { base, token } = requireConfig();
  await graphFetch(
    `${base}/${metaTemplateId}`,
    {
      method: "POST",
      body: JSON.stringify({
        category: input.category,
        components: buildComponents(
          input.positionalBody,
          input.paramOrder,
          input.footer
        ),
      }),
    },
    token
  );
};

export const deleteMetaTemplate = async (
  name: string,
  metaTemplateId?: string | null
): Promise<void> => {
  const { base, id, token } = requireConfig();
  const params = new URLSearchParams({ name });
  if (metaTemplateId) params.set("hsm_id", metaTemplateId);
  await graphFetch(
    `${base}/${id}/message_templates?${params.toString()}`,
    { method: "DELETE" },
    token
  );
};

export const listMetaTemplates = async (): Promise<MetaTemplateListItem[]> => {
  const { base, id, token } = requireConfig();
  const params = new URLSearchParams({
    fields: "name,status,category,language,id,rejected_reason",
    limit: "200",
  });
  const body = await graphFetch(
    `${base}/${id}/message_templates?${params.toString()}`,
    { method: "GET" },
    token
  );
  return (body.data as MetaTemplateListItem[] | undefined) || [];
};

/** Normalise Meta's status strings to our local enum. */
export const normaliseMetaStatus = (status?: string): MetaTemplateStatus => {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "DISABLED":
    case "PAUSED":
      return "DISABLED";
    case "PENDING":
    case "IN_APPEAL":
    case "PENDING_DELETION":
      return "PENDING";
    default:
      return "PENDING";
  }
};
