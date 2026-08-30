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
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    const d = qr.data
      .flatMap((row, y) =>
        row.flatMap((on, x) => (on ? [`M${x} ${y}h1v1h-1z`] : [])),
      )
      .join("");
    return { size: qr.size, path: d };
  }, [value]);

  return (
    <figure className={cn("mx-auto w-full max-w-[220px]", className)}>
      <div className="rounded-2xl bg-primary p-3">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="aspect-square w-full text-primary-fg"
          shapeRendering="crispEdges"
          role="img"
          aria-label={label ?? "UPI QR code"}
        >
          <path fill="currentColor" d={path} />
        </svg>
      </div>
      {label ? (
        <figcaption className="mt-2 text-center text-[11px] text-muted">{label}</figcaption>
      ) : null}
    </figure>
  );
}
