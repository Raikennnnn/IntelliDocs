"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      position="top-right"
      // Sit just below the maroon school header bar (login/registration/dashboard ≈ 63–64px).
      offset={{ top: "4.5rem", right: "1rem" }}
      mobileOffset={{ top: "4.5rem", right: "0.75rem" }}
      theme={theme as ToasterProps["theme"]}
      className="toaster group z-[100]"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
