type AgreementInfoItemProps = {
  label: string;
  value?: string | number | null;
};

export function AgreementInfoItem({ label, value }: AgreementInfoItemProps) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value || "-"}
      </p>
    </div>
  );
}