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
      <div className="bg-card/30 border border-border/30 rounded-xl overflow-hidden shadow-none">
        <div className="flex items-center gap-2 p-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/30">
          <HelpCircle size={14} className="text-primary" /> Support &amp; FAQs
        </div>
        <div className="p-3 grid gap-4 md:grid-cols-2">
          {faqs.map((faq, index) => (
            <div key={index} className="space-y-1">
              <p className="text-xs font-semibold text-foreground">{faq.question}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
