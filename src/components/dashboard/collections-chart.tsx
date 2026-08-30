import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { inr } from "@/lib/rent/months";
import type { MonthPoint } from "@/lib/rent/types";

export function CollectionsChart({ months }: { months: MonthPoint[] }) {
  if (months.length === 0) return null;
  return (
    <section className="rounded-3xl border border-border bg-surface p-5">
      <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Hisab</p>
      <h2 className="mt-1 font-display text-xl tracking-tight">Collected vs due</h2>
      <div className="mt-4 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) =>
                new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v)
              }
            />
            <Tooltip
              formatter={(value) => inr(Number(value ?? 0))}
              contentStyle={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                color: "var(--color-fg)",
              }}
            />
            <Area
              type="monotone"
              dataKey="collected"
              name="Collected"
              stroke="var(--color-accent)"
              fill="color-mix(in oklab, var(--color-accent) 22%, transparent)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="due"
              name="Due"
              stroke="var(--color-danger)"
              fill="color-mix(in oklab, var(--color-danger) 16%, transparent)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
