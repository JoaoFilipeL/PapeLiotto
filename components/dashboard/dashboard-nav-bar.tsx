'use client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
// Importa os ícones necessários para os itens de navegação
import { LayoutDashboard, Box, ShoppingCart, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils'; // Importa a função cn para classes condicionais

export function DashboardNavBar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }, // Adicionado Dashboard
    { href: "/stock", icon: Box, label: "Estoque" },
    { href: "/orders", icon: ShoppingCart, label: "Pedidos" },
    { href: "/budgets", icon: ClipboardList, label: "Orçamentos" },
  ];

  return (
    <nav
      className={cn(
        // Alinha os itens à esquerda com justify-start
        `w-full bg-black text-white p-2 border-b border-zinc-800 flex justify-start gap-4 overflow-x-auto px-4`,
        className
      )}
    >
      {navItems.map((item) => (
        <Link href={item.href} key={item.label} passHref>
          <Button
            className="flex items-center gap-2 p-3 text-sm font-normal bg-zinc-800 text-white border border-white hover:bg-zinc-700 hover:text-white rounded-md transition-colors whitespace-nowrap"
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Button>
        </Link>
      ))}
    </nav>
  );
}
