"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useLogout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const supabase = createClient();

  const logout = async () => {
    try {
      setIsLoggingOut(true);
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Brief delay to allow the state to propagate
      // and for the user to see the "Logging out..." indicator
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use window.location.href for a clean redirected state
      // This is often more reliable than router.push when session state 
      // is being cleared across the whole app.
      window.location.href = "/login";
    } catch (error) {
      console.error("Error during logout:", error);
      setIsLoggingOut(false);
    }
  };

  return { logout, isLoggingOut };
}
