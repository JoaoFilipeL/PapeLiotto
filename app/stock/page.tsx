import { DashboardApp } from "@/components/dashboard/dashboard-app"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { StockTable } from "@/components/stock/stock-table" // Importa o componente da tabela de estoque
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';

export default async function StockPage() { // Nome do componente alterado para StockPage
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
    <DashboardApp>
      {/* Título da página de estoque, conforme o protótipo */}
      <DashboardHeader heading="Estoque" text="Gerencie seus produtos em estoque e acompanhe a movimentação." />
      <div className="grid gap-8">
        <StockTable /> {/* Renderiza o componente da tabela de estoque */}
      </div>
    </DashboardApp>
  )
}
