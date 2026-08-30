import type { Metadata } from "next";
import { Newsreader, Inter_Tight } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentAuth — Identity & Permissions for AI Agents",
  description: "Purpose-built auth infrastructure for teams building autonomous agents. Cryptographic identities, scoped permissions, human-in-the-loop approvals, and a full audit trail.",
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'AgentAuth — Identity & Permissions for AI Agents',
    description: 'Purpose-built auth infrastructure for teams building autonomous agents.',
    type: 'website',
    siteName: 'AgentAuth',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentAuth — Identity & Permissions for AI Agents',
    description: 'Purpose-built auth infrastructure for teams building autonomous agents.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${interTight.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
