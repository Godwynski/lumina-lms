"use client";

import React, { useState } from "react";
import html2canvas from "html2canvas";
import { Download, Loader2 } from "lucide-react";
import { ShimmerButton } from "@/components/magicui/shimmer-button";

interface CardActionsProps {
  cardNumber: string;
}

const CardActions: React.FC<CardActionsProps> = ({ cardNumber }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadPNG = async () => {
    const element = document.getElementById("library-card-element");
    if (!element) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: null,
        logging: false,
        useCORS: true,
      });
      
      const link = document.createElement("a");
      link.download = `LibraryCard-${cardNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("PNG download failed", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-[400px] mx-auto mt-6 px-4">
      <ShimmerButton
        onClick={downloadPNG}
        disabled={isDownloading}
        background="rgba(79, 70, 229, 1)"
        className="w-full rounded-xl disabled:opacity-50 text-white py-3 font-semibold"
      >
        {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
        Download as Image (PNG)
      </ShimmerButton>

      {isDownloading && (
        <p className="text-center text-xs text-zinc-500 animate-pulse">
          Generating official high-resolution card...
        </p>
      )}
    </div>
  );
};

export default CardActions;