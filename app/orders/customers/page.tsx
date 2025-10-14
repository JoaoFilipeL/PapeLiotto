import { CustomersList } from "@/components/customers/customers-list" 
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';
import { App } from "@/components/header-app/app";

export default async function OrdersCustomersPage() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (session) loggedIn = true;
  } catch (error) {
    console.error('Error in OrdersCustomersPage component:', error);
  } finally {
    if (!loggedIn) redirect('/', RedirectType.replace);
  }

  return (
    <App>
      <div className="p-4 sm:p-6 lg:p-8">
        <CustomersList /> 
      </div>
    </App>
  )
}