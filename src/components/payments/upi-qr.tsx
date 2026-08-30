import { useMemo } from "react";
import { encode } from "uqr";
import { cn } from "@/lib/utils";

export function UpiQr({
  value,
  className,
  label,
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const qr = useMemo(() => {
    if (!value) return null;
    try {
      const matrix = encode(value, { ecc: "M", border: 4 });
      const d = matrix.data
        .flatMap((row, y) => row.flatMap((on, x) => (on ? [`M${x} ${y}h1v1h-1z`] : [])))
        .join("");
      return { size: matrix.size, path: d };
    } catch {
      return null;
    }
  }, [value]);

  if (!value || !qr) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
        QR is waiting on a UPI ID in building settings.
      </p>
    );
  }

  return (
    <figure className={cn("mx-auto w-full max-w-[240px]", className)}>
      <div className="rounded-2xl border border-neutral-200 p-3 shadow-sm" style={{ background: "#ffffff" }}>
        <svg
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          width={220}
          height={220}
          className="mx-auto block aspect-square w-full"
          shapeRendering="crispEdges"
          role="img"
          aria-label={label ?? "UPI QR code"}
        >
          <rect width={qr.size} height={qr.size} fill="#ffffff" />
          <path fill="#111111" d={qr.path} />
        </svg>
      </div>
      {label ? (
        <figcaption className="mt-2 text-center text-[11px] text-muted">{label}</figcaption>
      ) : null}
    </figure>
  );
}
