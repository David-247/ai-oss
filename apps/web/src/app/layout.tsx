import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ai-oss.net"),
  title: "AI-OSS.net",
  description:
    "Open research coordination platform for independent AI researchers, open-source AI developers, safety researchers, and evaluators.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
