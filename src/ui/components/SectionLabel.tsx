import type { ReactElement } from "react";
export function SectionLabel({ children }: { children: string }): ReactElement {
  return <div className="nyra-ruled-section-label">{children}</div>;
}
