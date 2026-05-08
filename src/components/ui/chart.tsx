import * as React from "react";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string; theme?: Record<string, string> }>;

function ChartContainer({ className, children, ...props }: React.ComponentProps<"div"> & { config?: ChartConfig }) {
  return <div className={cn("flex aspect-video justify-center text-xs", className)} {...props}>{children}</div>;
}

const ChartTooltip = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const ChartTooltipContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow", className)} {...props} />
));
ChartTooltipContent.displayName = "ChartTooltip";
const ChartLegend = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const ChartLegendContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center justify-center gap-4", className)} {...props} />
));
ChartLegendContent.displayName = "ChartLegend";
const ChartStyle = () => null;

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
