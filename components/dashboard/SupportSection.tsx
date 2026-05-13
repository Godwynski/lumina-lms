'use client';

import { HelpCircle } from 'lucide-react';

interface Faq {
  question: string;
  answer: string;
}

interface SupportSectionProps {
  faqs: Faq[];
}

export function SupportSection({ faqs }: SupportSectionProps) {
  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="pt-2">
      <div className="bg-card/10 border border-border/20 rounded-xl overflow-hidden shadow-none backdrop-blur-sm">
        <div className="flex items-center gap-2 p-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 border-b border-border/20">
          <HelpCircle size={14} className="text-primary" /> Support & FAQs
        </div>
        <div className="p-3 grid gap-4 md:grid-cols-2">
          {faqs.map((faq, index) => (
            <div key={index} className="space-y-1">
              <p className="text-xs font-bold text-foreground/90">{faq.question}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
