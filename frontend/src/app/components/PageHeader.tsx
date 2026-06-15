import { ReactNode } from "react";
import { cn } from "./ui/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("page-header", className)}>
      <div className="min-w-0">
        <h2 className="page-header-title">{title}</h2>
        {subtitle ? <p className="page-header-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
