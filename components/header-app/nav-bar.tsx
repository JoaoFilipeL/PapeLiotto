'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LayoutDashboard, Box, ShoppingCart, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function NavBar({ className }: React.HTMLAttributes<HTMLDivElement>) {
    const navItems = [
        { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { href: "/stock", icon: Box, label: "Estoque" },
        { href: "/orders", icon: ShoppingCart, label: "Pedidos" },
        { href: "/budgets", icon: ClipboardList, label: "Orçamentos" },
    ];

    const pathname = usePathname();

    return (
        <nav className={cn(`w-full bg-black text-white p-2 border-b border-zinc-800 flex justify-start gap-4 overflow-x-auto px-4`, className)} >
            {navItems.map((item) => (
                <Link href={item.href} key={item.label} passHref>
                    <Button
                        className={cn(
                            "cursor-pointer flex items-center gap-3 p-3 text-sm font-bold bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 hover:text-white rounded-md transition-colors whitespace-nowrap",
                            {
                                "bg-zinc-300 text-black hover:bg-zinc-700 hover:text-white": pathname === item.href
                            }
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                    </Button>
                </Link>
            ))}
        </nav>
    );
}