import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { App } from '@/components/header-app/app';
import { FutureOrdersTable } from '@/components/orders/future-orders-table';
import { TodayOrdersTable } from '@/components/orders/today-orders-table';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';

export default async function Dashboard() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in Dashboard component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace);
  }

  return (
    <App>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 sm:px-4 md:px-6 mb-6">
        <div className="grid gap-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm md:text-base text-zinc-400">Gerencie seus pedidos.</p>
        </div>
      </div>
        <DashboardStats />
      <div className="mt-8">
        <TodayOrdersTable />
      </div>
      <div className="mt-8">
        <FutureOrdersTable />
      </div>
    </App>
  )
}