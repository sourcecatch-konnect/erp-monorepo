/**
 * The hero artwork on "My role & training" — a lorry on a route, drawn here
 * rather than shipped as a PNG so it stays sharp at any size, costs no
 * request, and recolours itself from the theme tokens in dark mode.
 *
 * Purely decorative: aria-hidden, so a screen reader never announces it.
 */
export function TrainingIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 170"
      fill="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      {/* Soft background shapes */}
      <circle cx="168" cy="72" r="62" className="fill-primary/10" />
      <circle cx="92" cy="40" r="20" className="fill-learn-1/15" />
      <circle cx="232" cy="124" r="13" className="fill-learn-5/25" />

      {/* Road */}
      <rect
        x="16"
        y="131"
        width="228"
        height="3"
        rx="1.5"
        className="fill-border"
      />
      <g className="fill-primary/35">
        <rect x="28" y="141" width="22" height="3" rx="1.5" />
        <rect x="62" y="141" width="22" height="3" rx="1.5" />
        <rect x="96" y="141" width="22" height="3" rx="1.5" />
      </g>

      {/* Parcels waiting at the kerb */}
      <rect
        x="26"
        y="107"
        width="24"
        height="24"
        rx="3"
        className="fill-learn-5/30 stroke-learn-5"
        strokeWidth="2"
      />
      <path d="M38 107v24" className="stroke-learn-5" strokeWidth="2" />
      <rect
        x="54"
        y="117"
        width="16"
        height="14"
        rx="2.5"
        className="fill-learn-2/30 stroke-learn-2"
        strokeWidth="2"
      />

      {/* Lorry — cargo box */}
      <rect
        x="104"
        y="66"
        width="74"
        height="52"
        rx="5"
        className="fill-card stroke-primary"
        strokeWidth="2.5"
      />
      <rect
        x="114"
        y="78"
        width="54"
        height="5"
        rx="2.5"
        className="fill-primary/25"
      />
      <rect
        x="114"
        y="90"
        width="38"
        height="5"
        rx="2.5"
        className="fill-primary/15"
      />

      {/* Lorry — cab */}
      <path
        d="M178 84h20l16 20v14a4 4 0 0 1-4 4h-32V84z"
        className="fill-primary/15 stroke-primary"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M184 90h12l10 13h-22V90z"
        className="fill-learn-4/40 stroke-primary"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Wheels */}
      <circle cx="128" cy="122" r="11" className="fill-foreground/85" />
      <circle cx="128" cy="122" r="4" className="fill-card" />
      <circle cx="196" cy="122" r="11" className="fill-foreground/85" />
      <circle cx="196" cy="122" r="4" className="fill-card" />

      {/* Motion lines */}
      <g className="stroke-primary/40" strokeWidth="3" strokeLinecap="round">
        <path d="M78 76h18" />
        <path d="M68 90h28" />
        <path d="M82 104h14" />
      </g>

      {/* Sparkles — the "you are learning" note */}
      <path
        d="M92 34l2.6 6.4L101 43l-6.4 2.6L92 52l-2.6-6.4L83 43l6.4-2.6L92 34z"
        className="fill-learn-1"
      />
      <path
        d="M222 44l1.8 4.4 4.4 1.8-4.4 1.8-1.8 4.4-1.8-4.4-4.4-1.8 4.4-1.8L222 44z"
        className="fill-learn-5"
      />
      <circle cx="54" cy="62" r="3.5" className="fill-learn-3/60" />
    </svg>
  );
}
