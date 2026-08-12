import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "../components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Proteus",
  description:
    "Forecasting national-security questions, simulating the attacker's decisions, and ranking where systems are most exposed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Spectral (serif headings) + Public Sans (federal-grade body/UI). Loaded
            at runtime via link rather than next/font to avoid a build-time fetch. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Spectral:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
