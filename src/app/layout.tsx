import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { SITE } from "@/lib/data";
import "./globals.css";

const display = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

const body = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} | Line Dancing in Rugby`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "line dancing",
    "Rugby",
    "Midlands",
    "beginner dance classes",
    "Boots N Boogie",
    "country dance",
    "social dancing",
  ],
  icons: { icon: "/images/logo.png" },
  openGraph: {
    title: `${SITE.name} | Kick up your heels`,
    description: SITE.description,
    locale: "en_GB",
    type: "website",
    images: [{ url: "/images/logo.png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
