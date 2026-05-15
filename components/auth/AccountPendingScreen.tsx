"use client";

import React, { useState } from "react";
import { 
  ShieldAlert, 
  MapPin, 
  UserCheck, 
  Clock, 
  ArrowRight,
  LogOut,
  School
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogout } from "@/hooks/use-logout";
import { OnboardingForm } from "./OnboardingForm";


interface AccountPendingScreenProps {
  profile: {
    onboarding_completed?: boolean;
    address?: string | null;
    phone?: string | null;
    department?: string | null;
  };
  isStudent: boolean;
}

export function AccountPendingScreen({ 
  profile, 
  isStudent 
}: AccountPendingScreenProps) {
  const { logout, isLoggingOut } = useLogout();
  const [isEditing, setIsEditing] = useState(false);

  const needsOnboarding = isStudent && (
    !profile?.onboarding_completed || 
    !profile?.address || 
    !profile?.phone || 
    !profile?.department
  );

  if (needsOnboarding || isEditing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20 gap-6">
        <OnboardingForm initialData={profile} />
        {isEditing && (
          <Button 
            variant="ghost" 
            onClick={() => setIsEditing(false)}
            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            Cancel and Return
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <Card className="max-w-md w-full border-border shadow-2xl animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse-slow">
            <ShieldAlert className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Activation Required</CardTitle>
            <CardDescription className="text-base font-medium text-muted-foreground">
              Your account is currently pending approval.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-4">
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 text-center px-4">
              Verification Protocol
            </h4>
            
            <div className="space-y-3 px-1">
              {[
                {
                  icon: UserCheck,
                  title: "Present your ID",
                  description: "Show your valid School ID to the Librarian for verification."
                },
                {
                  icon: MapPin,
                  title: "Library Desk",
                  description: "Visit the main Library Circulation Desk during school hours."
                },
                {
                  icon: Clock,
                  title: "Instant Activation",
                  description: "Once verified, the librarian will activate your access immediately."
                }
              ].map((step, idx) => (
                <div 
                  key={idx}
                  className="flex gap-4 p-4 rounded-xl bg-muted/40 border border-border/50 group transition-all hover:bg-muted hover:border-primary/20"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-background flex items-center justify-center border group-hover:border-primary/30 transition-colors shadow-sm">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 items-start mx-1 shadow-inner">
            <School className="w-5 h-5 text-primary shrink-0 mt-0.5 opacity-70" />
            <p className="text-xs text-primary/70 leading-relaxed font-medium italic">
              &quot;This security measure ensures that library resources are reserved exclusively for active students and faculty members.&quot;
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pb-8 px-8">
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button 
              variant="outline" 
              className="w-full h-11 rounded-xl group font-semibold shadow-sm"
              onClick={() => window.location.reload()}
            >
              Status
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-11 rounded-xl group border-primary/20 hover:bg-primary/5 font-semibold shadow-sm transition-all"
              onClick={() => setIsEditing(true)}
            >
              Edit Info
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground hover:text-destructive h-10 rounded-lg font-medium transition-colors"
            onClick={() => logout()}
            disabled={isLoggingOut}
          >
            <LogOut className="mr-2 w-4 h-4" />
            {isLoggingOut ? "Signing out..." : "Sign Out"}
          </Button>
        </CardFooter>
      </Card>
      

    </div>
  );
}
