// AURELIUS UI — PANEL COMPONENT
import { cn } from "../../lib/utils";

export default function Panel({ children, className }: any) {
  return (
    <div
      className={cn(
        "bg-aurelius-charcoal/70 border border-aurelius-gold/30 rounded-xl p-6 backdrop-blur-md shadow-gold",
        className
      )}
    >
      {children}
    </div>
  );
}
