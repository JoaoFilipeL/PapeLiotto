import { DashboardApp } from "@/components/dashboard/dashboard-app"
import { CustomersList } from "@/components/customers/customers-list" 
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';

export default async function CustomersPage() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in CustomersPage component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace);
  }

  return (
    <DashboardApp>
      <div className="grid gap-8">
        <CustomersList /> 
      </div>
    </DashboardApp>
  )
}
