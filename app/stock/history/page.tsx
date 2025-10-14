import { App } from "@/components/header-app/app";
import { HistoryTable } from "@/components/history/history-table";
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';

export default async function StockHistoryPage() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in StockHistoryPage component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace);
  }

  return (
    <App>
      <div className="p-4 sm:p-6 lg:p-8">
        <HistoryTable />
      </div>
    </App>
  )
}