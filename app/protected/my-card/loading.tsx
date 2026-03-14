import React from "react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h2 className="text-xl font-bold text-zinc-900 text-transparent bg-clip-text animate-pulse">
        Loading your card...
      </h2>
      <p className="text-zinc-500 mt-2 max-w-xs animate-pulse">
        Fetching your library credentials. This should only take a moment.
      </p>
    </div>
  );
}
