import { App } from "@/components/header-app/app";
import { OrdersList } from "@/components/orders/orders-list";
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies }); 
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;

  } catch (error) {
    console.error('Error in OrdersPage component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace);
  }

  return (
    <App>
        <div className="p-4 sm:p-6 lg:p-8">
            <OrdersList />
        </div>
    </App>
  )
}