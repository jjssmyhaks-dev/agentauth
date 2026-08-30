import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      {/* Decorative circle */}
      <div className="relative mb-6">
        <div className="absolute inset-0 -m-3 rounded-full bg-foreground/5 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-hairline bg-surface/80">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
