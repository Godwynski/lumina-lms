'use client';

import { m } from "framer-motion";
import { 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  QrCode,
  Smartphone,
  CheckCircle2
} from "lucide-react";
import DigitalCard from "@/components/library/DigitalCard";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: "Join",
    description: "Secure your unique student identity in seconds."
  },
  {
    icon: <Smartphone className="w-6 h-6" />,
    title: "Identify",
    description: "Your digital card lives on your dashboard."
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Borrow",
    description: "Scan, confirm, and take your resources with you."
  }
];

export function LandingExperience() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" as const } }
  };

  return (
    <section className="w-full py-24 px-6 md:px-10 bg-background relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <m.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-7xl mx-auto space-y-24"
      >
        {/* Section Header */}
        <div className="text-center space-y-4">
          <m.div variants={itemVariants}>
            <span className="text-xs font-bold tracking-[0.3em] uppercase text-primary/60">The Experience</span>
          </m.div>
          <m.h2 variants={itemVariants} className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            Circulation Reimagined.
          </m.h2>
          <m.p variants={itemVariants} className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Traditional library processes modernized for the digital-first student.
          </m.p>
        </div>

        {/* Feature Grid: Card + Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Card Preview */}
          <m.div variants={itemVariants} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-transparent rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
            
            <div className="relative rounded-[2rem] border border-border/50 bg-card/10 backdrop-blur-sm p-4 sm:p-8 transform transition-all duration-500 hover:scale-[1.02] hover:-rotate-1">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Digital Identity</span>
                </div>
                <QrCode className="w-4 h-4 text-muted-foreground" />
              </div>

              <div className="pointer-events-none">
                <DigitalCard 
                  fullName="ALEXIS TRAVIS"
                  studentId="2024-00123-AL-0"
                  cardNumber="LUM-88-293-1"
                  department="COMPUTER SCIENCE"
                  status="active"
                  expiryDate="2025-05-30"
                  avatarUrl={null}
                  qrUrl={null}
                />
              </div>

              <div className="mt-8 pt-6 border-t border-border/50">
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  Every account includes a verifiable digital library card, eliminating the need for physical IDs and streamlining every interaction.
                </p>
              </div>
            </div>
          </m.div>

          {/* Steps */}
          <div className="space-y-12">
            {STEPS.map((step, idx) => (
              <m.div 
                key={step.title}
                variants={itemVariants}
                className="flex gap-6 group"
              >
                <div className="flex-shrink-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border/50 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 group-hover:scale-110 shadow-sm">
                  {step.icon}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    {step.title}
                    {idx === 2 && <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed leading-snug">
                    {step.description}
                  </p>
                </div>
              </m.div>
            ))}

            <m.div variants={itemVariants} className="pt-4">
              <Button asChild className="rounded-full h-12 px-8 font-bold shadow-lg shadow-primary/20">
                <a href="/login">
                  Get Started Now 
                  <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </Button>
            </m.div>
          </div>
        </div>

        {/* Instant Access Banner */}
        <m.div 
          variants={itemVariants}
          className="rounded-[3rem] bg-muted/30 border border-border/50 p-12 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Universal Access</span>
            </div>
            <h3 className="text-2xl font-bold">Scanning for Success</h3>
            <p className="text-muted-foreground max-w-sm">
              Use your ID to check out books, access campus scanners, and log attendance instantly.
            </p>
          </div>
          
          <div className="bg-card p-4 rounded-3xl border border-border/50 shadow-inner group/qr">
            <QrCode className="w-24 h-24 text-foreground/20 group-hover/qr:text-primary transition-colors duration-500" />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-center text-muted-foreground/50 group-hover/qr:text-primary/50">Mock QR</p>
          </div>
        </m.div>
      </m.div>
    </section>
  );
}
