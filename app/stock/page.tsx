import { App } from "@/components/header-app/app";
import { StockTable } from "@/components/stock/stock-table"
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies }); 
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in StockPage component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace);
  }

  return (
    <App>
      <div className="p-4 sm:p-6 lg:p-8">
        <StockTable />
      </div>
    </App>
  )
}