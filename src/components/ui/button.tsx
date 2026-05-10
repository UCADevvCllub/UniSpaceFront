import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition",
        variant === "default"
          ? "bg-primary text-white hover:bg-teal-700"
          : "border border-slate-300 bg-white hover:bg-slate-50",
        className,
      )}
      {...props}
    />
  );
}
