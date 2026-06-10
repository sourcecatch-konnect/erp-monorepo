import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalDateString = z
  .string()
  .optional()
  .transform((value): string | undefined => {
    if (!value) return undefined;
    return new Date(value).toISOString();
  });

const numberField = (message: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (value === "" ? undefined : Number(value)))
    .refine(
      (value) => value === undefined || !Number.isNaN(value),
      message
    );

const optionalPositiveNumber = (message: string) =>
  numberField(message)
    .refine(
      (value) => value === undefined || value >= 0,
      `${message.split(" ")[0]} cannot be negative`
    )
    .optional();

const optionalBoolean = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return false;
  });

export const driverStatusSchema = z.enum(["AVAILABLE", "ON_TRIP"]);

export const driverTypeSchema = z.enum(["Permanent", "Contract", "Owner"]);

export const bloodGroupSchema = z.enum([
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
]);

const mobileRegex = /^[6-9][0-9]{9}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const aadharRegex = /^[2-9][0-9]{11}$/;
const licenseRegex = /^[A-Z]{2}[0-9]{2}[0-9 -]{6,14}$/;

export const driverSchema = z.object({
  id: z.string(),
  name: z.string(),
  photoPath: z.string().nullable().optional(),
  status: driverStatusSchema,
  type: z.string(),
  birthDate: z.string().nullable().optional(),
  anniversaryDate: z.string().nullable().optional(),
  mobile: z.string(),
  alternateMobile: z.string().nullable().optional(),
  licenseNo: z.string(),
  licenseDate: z.string().nullable().optional(),
  licenseExpiryDate: z.string().nullable().optional(),
  licenseCity: z.string().nullable().optional(),
  permanentAddress: z.string().nullable().optional(),
  permanentCountry: z.string().nullable().optional(),
  permanentState: z.string().nullable().optional(),
  permanentCity: z.string().nullable().optional(),
  correspondenceAddress: z.string().nullable().optional(),
  correspondenceCountry: z.string().nullable().optional(),
  correspondenceState: z.string().nullable().optional(),
  correspondenceCity: z.string().nullable().optional(),
  correspondenceLandline: z.string().nullable().optional(),
  referencePerson: z.string().nullable().optional(),
  referenceContactNo: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  otherDetails: z.string().nullable().optional(),
  salary: z.number().nullable().optional(),
  panNo: z.string().nullable().optional(),
  aadharCardNo: z.string().nullable().optional(),
  noTDSApplyAmount: z.number().nullable().optional(),
  tdsRate: z.number().nullable().optional(),
  onLeave: z.boolean(),
  blackListed: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createDriverSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name cannot exceed 80 characters")
      .regex(
        /^[A-Za-z][A-Za-z .'-]*$/,
        "Name can only contain letters, spaces, dots, apostrophes and hyphens"
      ),

    photoPath: optionalString,

    status: driverStatusSchema,

    type: z
      .string()
      .trim()
      .min(1, "Driver type is required")
      .max(40, "Driver type cannot exceed 40 characters"),

    birthDate: optionalDateString,
    anniversaryDate: optionalDateString,

    mobile: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, ""))
      .pipe(
        z
          .string()
          .min(1, "Mobile number is required")
          .regex(mobileRegex, "Enter a valid 10-digit mobile starting 6-9")
      ),

    alternateMobile: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value.replace(/\s+/g, "") : undefined))
      .pipe(
        z
          .string()
          .regex(mobileRegex, "Enter a valid 10-digit mobile starting 6-9")
          .optional()
      ),

    licenseNo: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(
        z
          .string()
          .min(8, "License number must be at least 8 characters")
          .max(20, "License number cannot exceed 20 characters")
          .regex(
            licenseRegex,
            "Enter a valid license number (e.g. MH1420110012345)"
          )
      ),

    licenseDate: optionalDateString,
    licenseExpiryDate: optionalDateString,
    licenseCity: optionalString,

    permanentAddress: z
      .string()
      .trim()
      .max(250, "Address cannot exceed 250 characters")
      .optional()
      .transform((value) => (value ? value : undefined)),
    permanentCountry: optionalString,
    permanentState: optionalString,
    permanentCity: optionalString,

    correspondenceAddress: z
      .string()
      .trim()
      .max(250, "Address cannot exceed 250 characters")
      .optional()
      .transform((value) => (value ? value : undefined)),
    correspondenceCountry: optionalString,
    correspondenceState: optionalString,
    correspondenceCity: optionalString,
    correspondenceLandline: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value.replace(/\s+/g, "") : undefined))
      .pipe(
        z
          .string()
          .regex(
            /^[0-9+\-()]{6,15}$/,
            "Enter a valid landline number"
          )
          .optional()
      ),

    referencePerson: z
      .string()
      .trim()
      .max(80, "Reference name cannot exceed 80 characters")
      .optional()
      .transform((value) => (value ? value : undefined)),
    referenceContactNo: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value.replace(/\s+/g, "") : undefined))
      .pipe(
        z
          .string()
          .regex(mobileRegex, "Enter a valid 10-digit mobile starting 6-9")
          .optional()
      ),

    bloodGroup: optionalString,
    otherDetails: z
      .string()
      .trim()
      .max(500, "Details cannot exceed 500 characters")
      .optional()
      .transform((value) => (value ? value : undefined)),

    salary: optionalPositiveNumber("Salary must be a valid number"),

    panNo: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value.toUpperCase() : undefined))
      .pipe(
        z
          .string()
          .regex(panRegex, "Enter valid PAN, e.g. ABCDE1234F")
          .optional()
      ),

    aadharCardNo: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value.replace(/\s+/g, "") : undefined))
      .pipe(
        z
          .string()
          .regex(aadharRegex, "Aadhar must be a valid 12-digit number")
          .optional()
      ),

    noTDSApplyAmount: optionalPositiveNumber("TDS threshold must be a number"),

    tdsRate: numberField("TDS rate must be a number")
      .refine(
        (value) => value === undefined || (value >= 0 && value <= 100),
        "TDS rate must be between 0 and 100"
      )
      .optional(),

    onLeave: optionalBoolean,
    blackListed: optionalBoolean,
  })
  .superRefine((data, ctx) => {
    if (
      data.licenseDate &&
      data.licenseExpiryDate &&
      new Date(String(data.licenseExpiryDate)) <= new Date(String(data.licenseDate))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["licenseExpiryDate"],
        message: "License expiry must be after license issue date",
      });
    }

    if (
      data.alternateMobile &&
      data.mobile &&
      data.alternateMobile === data.mobile
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternateMobile"],
        message: "Alternate mobile cannot be same as primary mobile",
      });
    }
  });

export const updateDriverSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    photoPath: optionalString,
    status: driverStatusSchema.optional(),
    type: z.string().trim().min(1).max(40).optional(),
    birthDate: optionalDateString,
    anniversaryDate: optionalDateString,
    mobile: z
      .string()
      .trim()
      .regex(mobileRegex, "Enter a valid 10-digit mobile starting 6-9")
      .optional(),
    alternateMobile: optionalString,
    licenseNo: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(licenseRegex, "Enter a valid license number"))
      .optional(),
    licenseDate: optionalDateString,
    licenseExpiryDate: optionalDateString,
    licenseCity: optionalString,
    permanentAddress: optionalString,
    permanentCountry: optionalString,
    permanentState: optionalString,
    permanentCity: optionalString,
    correspondenceAddress: optionalString,
    correspondenceCountry: optionalString,
    correspondenceState: optionalString,
    correspondenceCity: optionalString,
    correspondenceLandline: optionalString,
    referencePerson: optionalString,
    referenceContactNo: optionalString,
    bloodGroup: optionalString,
    otherDetails: optionalString,
    salary: optionalPositiveNumber("Salary must be a valid number"),
    panNo: optionalString,
    aadharCardNo: optionalString,
    noTDSApplyAmount: optionalPositiveNumber("TDS threshold must be a number"),
    tdsRate: numberField("TDS rate must be a number").optional(),
    onLeave: optionalBoolean,
    blackListed: optionalBoolean,
  })
  .partial();
