import { Suspense, use } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { UsersContent } from "./UsersContent";
import { getUsers } from "@/lib/actions/users";

const PAGE_SIZE = 12;

// getMe() is cache()-memoized — reuses the auth result from the layout,
// zero extra network round-trip. The .then() chain is non-blocking.
function buildUsersPromise() {
  return getMe().then(async (me) => {
    if (!me) redirect("/");
    const { role } = me;

    if (role !== "super_admin" && role !== "librarian") {
      redirect("/dashboard");
    }

    const { users, total } = await getUsers({ tab: "all", page: 1, pageSize: PAGE_SIZE });

    return {
      users,
      count: total,
      currentRole: role,
    };
  });
}

// Synchronous page shell — responds immediately.
// Promise fires in the background; UsersContent uses use() to consume it.
export default function UsersPage() {
  const usersPromise = buildUsersPromise();

  return (
    <div className="space-y-6">
      <Suspense fallback={<UsersSkeleton />}>
        <UserPageWrapper usersPromise={usersPromise} />
      </Suspense>
    </div>
  );
}

function UserPageWrapper({ usersPromise }: { usersPromise: ReturnType<typeof buildUsersPromise> }) {
  const { currentRole } = use(usersPromise);
  
  return <UsersContent usersPromise={usersPromise} currentRole={currentRole as "super_admin" | "librarian" | "student_assistant" | "student"} />;
}

function UsersSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="h-10 w-64 bg-muted rounded-lg" />
      <div className="h-8 w-full bg-muted rounded-md" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-full bg-muted/40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
