import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { UserNav } from "@/components/user-nav";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JustRecipe — just the recipe",
  description: "Paste a recipe link and get just the recipe. No life story, no pop-ups.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border print:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
              Just<span className="text-accent">Recipe</span>
            </Link>
            <Suspense fallback={<div className="h-9" />}>
              <UserNav />
            </Suspense>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="py-8 text-center text-sm text-muted print:hidden">
          Recipes belong to their authors. We link back to every source.
        </footer>
      </body>
    </html>
  );
}
