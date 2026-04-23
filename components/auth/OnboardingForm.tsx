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

export function OnboardingForm({ 
  initialData 
}: { 
  initialData?: {
    address?: string | null;
    phone?: string | null;
    department?: string | null;
  }
}) {
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
      // The page will revalidate and show the "Pending" state in AccountPendingScreen
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
      <Card className="max-w-md w-full border-2 border-primary/20 shadow-2xl animate-in zoom-in duration-300">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Information Received</CardTitle>
          <CardDescription>
            Thank you! Your profile has been updated. Please visit the library with your Physical ID for final activation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
           <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md w-full border-2 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold tracking-tight">Complete Your Profile</CardTitle>
        <CardDescription>
          Provide your details to enable your digital library card.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Home Address
            </Label>
            <Input 
              id="address"
              placeholder="House No., Street, Brgy, City"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="h-11 rounded-lg"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Contact Number
            </Label>
            <Input 
              id="phone"
              type="tel"
              placeholder="e.g. 0912 345 6789"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="h-11 rounded-lg"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="program" className="text-sm font-medium flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
              Academic Program
            </Label>
            <Select 
              value={formData.department}
              onValueChange={(val) => setFormData(prev => ({ ...prev, department: val }))}
              required
            >
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue placeholder="Select your program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((prog) => (
                  <SelectItem key={prog} value={prog}>
                    {prog}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2">
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base font-semibold group relative overflow-hidden"
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
