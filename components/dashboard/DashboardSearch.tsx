'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState } from 'react';

interface DashboardSearchProps {
  role: string | null;
}

export function DashboardSearch({ role }: DashboardSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const path = role === 'student' ? '/protected/student-catalog' : '/protected/catalog';
    router.push(`${path}?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-sm sm:w-auto">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search books, ISBN, or authors..."
        className="h-10 w-full rounded-full border border-border bg-muted/30 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-sm md:max-w-md"
      />
    </form>
  );
}
