// AURELIUS UI — CARD COMPONENT
import { cn } from "../../lib/utils";

export default function Card({ children, className }: any) {
  return (
    <div
      className={cn(
        "aurelius-panel border border-aurelius-gold rounded-xl p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
