
import { Input } from "@skerp/ui/components/input";
import {
  FieldValues,
  Path,
  get,
  useController,
  useFormContext,
} from "react-hook-form";
export function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1 block text-xs font-medium text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-red-600">*</span>}
    </label>
  );
}
function cleanAmountInput(value: string) {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = cleaned.split(".");
  const decimal = decimalParts.join("").slice(0, 2);

  return decimalParts.length > 0 ? `${whole}.${decimal}` : whole;
}

function formatAmountInput(value: unknown) {
  const raw = String(value ?? "").replace(/,/g, "");

  if (!raw) return "";

  const [whole = "", decimal] = raw.split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return decimal !== undefined
    ? `${formattedWhole}.${decimal}`
    : formattedWhole;
}

export function MoneyField<TFormValues extends FieldValues>({
  name,
  label,
  required,
  placeholder = "0.00",
  readOnly = false,
}: {
  name: Path<TFormValues>;
  label: string;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<TFormValues>();

  const { field } = useController({
    name,
    control,
  });

  const error = get(errors, name)?.message;

  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
          ₹
        </span>

        <Input
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={formatAmountInput(field.value)}
          onChange={(event) => {
            if (readOnly) return;
            field.onChange(cleanAmountInput(event.target.value));
          }}
          onBlur={field.onBlur}
          readOnly={readOnly}
          className={
            readOnly
              ? "h-9 bg-muted/40 pl-7 text-right tabular-nums"
              : "h-9 pl-7 text-right tabular-nums"
          }
          aria-invalid={Boolean(error)}
        />
      </div>

      {typeof error === "string" ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}