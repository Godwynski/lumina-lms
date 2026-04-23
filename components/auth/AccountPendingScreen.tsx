"use client";

import React from "react";
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

export function AccountPendingScreen({ 
  profile, 
  isStudent 
}: { 
  profile: {
    onboarding_completed?: boolean;
    address?: string | null;
    phone?: string | null;
    department?: string | null;
  }; 
  isStudent: boolean;
}) {
  const { logout, isLoggingOut } = useLogout();
  const [isEditing, setIsEditing] = React.useState(false);

  const needsOnboarding = isStudent && (!profile?.onboarding_completed || !profile?.address || !profile?.phone || !profile?.department);

  if (needsOnboarding || isEditing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20 gap-4">
        <OnboardingForm initialData={profile} />
        {isEditing && (
          <Button 
            variant="ghost" 
            onClick={() => setIsEditing(false)}
            className="text-muted-foreground"
          >
            Cancel and Return
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <Card className="max-w-md w-full border-2 shadow-2xl animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <ShieldAlert className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Activation Required</CardTitle>
            <CardDescription className="text-base font-medium">
              Your account is currently pending approval.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-4">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">In-Person Verification</h4>
            
            <div className="space-y-3">
              <div className="flex gap-4 p-4 rounded-xl bg-muted/50 border border-border/50 group transition-colors hover:bg-muted">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-background flex items-center justify-center border group-hover:border-primary/50 transition-colors">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Present your ID</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Show your valid School ID to the Librarian for verification.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-muted/50 border border-border/50 group transition-colors hover:bg-muted">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-background flex items-center justify-center border group-hover:border-primary/50 transition-colors">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Library Desk</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Visit the main Library Circulation Desk during school hours.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-muted/50 border border-border/50 group transition-colors hover:bg-muted">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-background flex items-center justify-center border group-hover:border-primary/50 transition-colors">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Instant Activation</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Once verified, the librarian will activate your access immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex gap-3 items-start">
            <School className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-primary/80 leading-relaxed italic">
              &quot;This security measure ensures that library resources are reserved exclusively for active students and faculty members.&quot;
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pb-8">
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button 
              variant="outline" 
              className="w-full h-11 rounded-xl group"
              onClick={() => window.location.reload()}
            >
              Check Status
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-11 rounded-xl group border-primary/20 hover:bg-primary/5"
              onClick={() => setIsEditing(true)}
            >
              Edit Info
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground hover:text-destructive h-10 rounded-lg"
            onClick={() => logout()}
            disabled={isLoggingOut}
          >
            <LogOut className="mr-2 w-4 h-4" />
            {isLoggingOut ? "Signing out..." : "Sign Out"}
          </Button>
        </CardFooter>
      </Card>
      
      <div className="fixed bottom-8 left-0 right-0 text-center">
        <p className="text-xs text-muted-foreground font-medium">
          Lumina LMS &bull; Security Protocol
        </p>
      </div>
    </div>
  );
}
