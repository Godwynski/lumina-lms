'use client';

import type { User } from '@supabase/supabase-js';
import { m } from "framer-motion";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function Hero({ user, role }: { user: User | null; role: string | null }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8 } }
  };

  return (
    <m.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto py-12 md:py-24"
    >

      <m.div variants={itemVariants} className="space-y-6 mb-10">
        <h1 className="text-balance text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl">
          {user ? (
            <>Welcome back, <br className="hidden sm:block"/><span className="text-muted-foreground">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>.</>
          ) : (
            <>Intelligent Library Operations for the <span className="text-muted-foreground">Modern Era.</span></>
          )}
        </h1>
        <p className="text-balance text-lg text-muted-foreground sm:text-xl md:max-w-2xl mx-auto">
          {user ? (
            `You are signed in with the ${role} role and have access to your workspace.`
          ) : (
            'Streamline physical and digital resource management with role-based access, smart circulation, and unified identity.'
          )}
        </p>
      </m.div>

      <m.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 items-center">
        {user ? (
          <>
            <Button asChild size="lg" className="rounded-full font-semibold shadow-md px-8 h-12">
              <Link href="/dashboard">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="lg" className="rounded-full font-semibold shadow-md px-8 h-12">
              <Link href="/login">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        )}
      </m.div>
    </m.div>
  );
}
