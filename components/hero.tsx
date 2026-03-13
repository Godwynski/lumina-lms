import type { User } from '@supabase/supabase-js';
import BlurFade from './magicui/blur-fade';
import { AnimatedShinyText } from './magicui/animated-shiny-text';

export function Hero({ user, role }: { user: User | null; role: string | null }) {
  return (
    <div className="flex flex-col gap-8 items-center justify-center p-8 lg:p-12 bg-white/70 backdrop-blur-md border border-zinc-200/50 rounded-[32px] shadow-sm relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
      
      <BlurFade delay={0.1} inView>
        <div className="flex items-center gap-4 z-10">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
          </div>
          <span className="text-4xl lg:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-zinc-900 to-zinc-500 tracking-tight">
            Lumina
          </span>
        </div>
      </BlurFade>

      <div className="text-center z-10 flex flex-col gap-4">
        {user ? (
          <>
            <BlurFade delay={0.2} inView>
              <h1 className="text-3xl lg:text-4xl font-bold !leading-tight mx-auto max-w-2xl text-zinc-900">
                Welcome back, <span className="text-indigo-600">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>
              </h1>
            </BlurFade>
            <BlurFade delay={0.3} inView>
              <p className="text-zinc-600 max-w-xl mx-auto text-base md:text-lg leading-relaxed">
                You are currently logged in with the <span className="text-emerald-600 font-semibold uppercase tracking-widest">{role}</span> role.
              </p>
            </BlurFade>
          </>
        ) : (
          <>
            <BlurFade delay={0.2} inView>
              <div className="mb-4 flex justify-center">
                <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400 rounded-full border border-black/5 bg-neutral-100 text-sm">
                  ✨ Discover a Smarter Campus Library
                </AnimatedShinyText>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold !leading-tight mx-auto max-w-2xl text-zinc-900">
                Next-Generation <span className="text-indigo-600">Library Management</span>
              </h1>
            </BlurFade>
            <BlurFade delay={0.3} inView>
              <p className="text-zinc-600 max-w-xl mx-auto text-base md:text-lg leading-relaxed mt-4">
                A premium, responsive library system. Seamlessly connecting Admins, Librarians, Staff, and Students in one unified platform.
              </p>
            </BlurFade>
          </>
        )}
      </div>

      <div className="w-full max-w-md h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent my-4 z-10" />
    </div>
  );
}
