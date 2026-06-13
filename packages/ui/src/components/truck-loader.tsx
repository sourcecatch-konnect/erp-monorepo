import { cn } from "../lib/util";

/**
 * Animated semi-truck loading indicator: spinning spoked wheels, scrolling
 * road dashes and a faint suspension bob. Keyframes (truck-wheel, truck-bob,
 * truck-road) live in the app's globals.css / ui index.css; motion is
 * suppressed globally via prefers-reduced-motion.
 */
function Wheel({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="7" className="fill-foreground" />
      <circle cx={cx} cy={cy} r="3.8" className="fill-background" />
      <g className="origin-center animate-truck-wheel [transform-box:fill-box]">
        {[0, 60, 120].map((angle) => (
          <line
            key={angle}
            x1={cx - 3.2}
            y1={cy}
            x2={cx + 3.2}
            y2={cy}
            transform={`rotate(${angle} ${cx} ${cy})`}
            strokeWidth="1.1"
            className="stroke-foreground"
          />
        ))}
      </g>
      <circle cx={cx} cy={cy} r="1.1" className="fill-foreground" />
    </g>
  );
}

type TruckLoaderProps = React.ComponentProps<"div"> & {
  label?: string | null;
};

function TruckLoader({ className, label = "Loading…", ...props }: TruckLoaderProps) {
  return (
    <div
      data-slot="truck-loader"
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center gap-3", className)}
      {...props}
    >
      <svg
        viewBox="0 0 140 64"
        fill="none"
        aria-hidden="true"
        className="w-32 shrink-0"
      >
        <g className="animate-truck-bob">
          {/* exhaust stack between trailer and cab */}
          <rect x="77.2" y="13" width="2.6" height="28" rx="1.2" className="fill-foreground/60" />
          {/* trailer */}
          <rect x="8" y="10" width="68" height="30" rx="2" strokeWidth="1.5" className="fill-muted stroke-foreground" />
          <path d="M18 13.5v23M28 13.5v23M38 13.5v23M48 13.5v23M58 13.5v23M68 13.5v23" strokeWidth="1" className="stroke-foreground/10" />
          <rect x="9" y="33" width="66" height="2.5" className="fill-primary/60" />
          {/* chassis frame */}
          <rect x="8" y="40" width="118" height="2.5" rx="1" className="fill-foreground/30" />
          {/* trailer landing gear */}
          <path d="M62 42.5v4M58 46.5h8" strokeWidth="1.2" className="stroke-foreground/40" />
          {/* cab */}
          <path
            d="M80 40.5 L80 18 Q80 15 83 15 L95 15 Q98.5 15 100.5 17.5 L107 25.5 L117 25.5 Q120 25.5 121 28.5 L123.5 35.5 Q124 37 124 38.5 L124 40.5 Z"
            className="fill-primary"
          />
          {/* windshield + side window */}
          <path
            d="M84 18.5 L95 18.5 Q96.8 18.5 98 20 L102.5 25.5 L84 25.5 Z"
            className="fill-background/90"
          />
          {/* door seam + handle */}
          <path d="M104 25.5V40.5M105.5 29h3" strokeWidth="1" className="stroke-background/60" />
          {/* headlight + bumper */}
          <rect x="122.6" y="31.5" width="2" height="3" rx="0.8" className="fill-background/90" />
          <rect x="122.5" y="36" width="3.5" height="7" rx="1.2" className="fill-foreground/40" />
          {/* fuel tank */}
          <rect x="98" y="43" width="13" height="5.5" rx="2.75" strokeWidth="1" className="fill-muted stroke-foreground/40" />
          <Wheel cx={24} cy={49} />
          <Wheel cx={38} cy={49} />
          <Wheel cx={90} cy={49} />
          <Wheel cx={114} cy={49} />
        </g>
        {/* road */}
        <path
          d="M2 57.5H138"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="10 14"
          className="stroke-foreground/35 animate-truck-road"
        />
      </svg>
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}

export { TruckLoader };
