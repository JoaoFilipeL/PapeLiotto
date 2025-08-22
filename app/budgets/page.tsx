import { BudgetsList } from "@/components/budgets/budgets-list";
import { DashboardApp } from "@/components/dashboard/dashboard-app"
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';

export default async function BudgetsPage() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in BudgetsPage component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace);
  }

  return (
    <DashboardApp>
        <div className="p-4 sm:p-6 lg:p-8">
            <BudgetsList />
        </div>
    </DashboardApp>
  )
}