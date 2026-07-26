import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/data";

export const metadata: Metadata = {
  title: `Community Chat | ${SITE.name}`,
  description: "Subscriber community chat for Boots N Boogie members.",
  applicationName: "BnB Chat",
  appleWebApp: {
    capable: true,
    title: "BnB Chat",
    statusBarStyle: "black-translucent",
  },
  icons: { icon: "/images/logo.png", apple: "/images/logo.png" },
  manifest: "/community/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0c0907",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/** Chat PWA shell — no main site header/footer (hidden via route check in Header/Footer). */
export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-bg text-foreground">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-3 pb-[env(safe-area-inset-bottom)] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {children}
      </div>
    </div>
  );
}
