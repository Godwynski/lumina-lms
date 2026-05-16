"use client";

import React, { useState, useEffect } from "react";
import { 
  MapPin, 
  Phone, 
  GraduationCap, 
  ArrowRight,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAcademicPrograms, submitOnboarding } from "@/lib/actions/onboarding";
import { toast } from "sonner";


interface OnboardingFormProps {
  initialData?: {
    address?: string | null;
    phone?: string | null;
    department?: string | null;
  };
}

export function OnboardingForm({ initialData }: OnboardingFormProps) {
  const [programs, setPrograms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    address: initialData?.address || "",
    phone: initialData?.phone || "",
    department: initialData?.department || ""
  });

  useEffect(() => {
    getAcademicPrograms().then(setPrograms);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.address || !formData.phone || !formData.department) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitOnboarding(formData);
      setIsSuccess(true);
      toast.success("Profile submitted successfully!");
      
      // Reload to trigger AccountPendingScreen updates
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="max-w-md w-full border-primary/20 shadow-2xl animate-in zoom-in duration-500">
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center animate-bounce-subtle">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight">Information Received</CardTitle>
            <CardDescription className="text-base px-4">
              Your profile has been updated successfully. Redirecting you to status page...
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center pb-12 gap-4">
           <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
           <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Processing</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md w-full border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">Complete Your Profile</CardTitle>
        <CardDescription>
          Provide your details to enable your digital library card.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Home Address
            </Label>
            <Input 
              id="address"
              placeholder="House No., Street, Brgy, City"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="h-11 rounded-xl transition-all focus-visible:ring-primary/20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-semibold flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              Contact Number
            </Label>
            <Input 
              id="phone"
              type="tel"
              placeholder="e.g. 09123456789"
              value={formData.phone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                if (value.length <= 11) {
                  setFormData(prev => ({ ...prev, phone: value }));
                }
              }}
              className="h-11 rounded-xl transition-all focus-visible:ring-primary/20"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="program" className="text-sm font-semibold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              Academic Program
            </Label>
            <Select 
              value={formData.department}
              onValueChange={(val) => setFormData(prev => ({ ...prev, department: val }))}
              required
            >
              <SelectTrigger className="h-11 rounded-xl transition-all focus-visible:ring-primary/20">
                <SelectValue placeholder="Select your program" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {programs.map((prog) => (
                  <SelectItem key={prog} value={prog} className="rounded-lg">
                    {prog}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2">
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base font-bold group relative overflow-hidden bg-primary text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Submit for Approval
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
