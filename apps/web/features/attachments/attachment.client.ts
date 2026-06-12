"use client";

import { createAttachmentApi } from "@skerp/attachments-web";
import { api } from "@/lib/api";

/** Shared attachments API bound to the app's axios instance (httpOnly cookies). */
export const attachmentApi = createAttachmentApi(api);
