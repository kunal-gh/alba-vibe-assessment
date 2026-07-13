"use client";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { DataProvider } from "@/lib/data-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudioPage = pathname?.startsWith('/studio');

  if (isStudioPage) return <>{children}</>;

  return (
    <SessionProvider>
      <DataProvider>
        {children}
      </DataProvider>
    </SessionProvider>
  );
}
