import React from "react";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-slate-700 border-t-transparent" />
      <h2 className="text-xl font-bold text-zinc-900">
        Loading your card...
      </h2>
      <p className="mt-2 max-w-xs text-zinc-500">
        Fetching your library credentials. This should only take a moment.
      </p>
    </div>
  );
}
