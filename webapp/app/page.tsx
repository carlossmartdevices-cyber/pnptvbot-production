import { Hero } from "@/components/layout/hero";
import { Features } from "@/components/layout/features";
import { Pricing } from "@/components/layout/pricing";
import { CTA } from "@/components/layout/cta";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
