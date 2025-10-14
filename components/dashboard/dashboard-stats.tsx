"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingBag, DollarSign, Package, TrendingUp, Loader2 } from "lucide-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function DashboardStats() {
    const [ordersToday, setOrdersToday] = useState(0);
    const [revenueToday, setRevenueToday] = useState(0);
    const [lowStockProducts, setLowStockProducts] = useState(0);
    const [monthlyRevenue, setMonthlyRevenue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClientComponentClient();

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('status, total_amount, order_date')
                .gte('created_at', todayStart)
                .lte('created_at', todayEnd);

            if (ordersError) throw new Error(`Erro ao buscar pedidos: ${ordersError.message}`);

            setOrdersToday(ordersData.length);
            const revenueSumToday = ordersData
                .filter(order => order.status !== 'Cancelado')
                .reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0);
            setRevenueToday(revenueSumToday);

            const { data: stockData, error: stockError } = await supabase
                .from('stock')
                .select('quantity, min_quantity');

            if (stockError) throw new Error(`Erro ao buscar estoque: ${stockError.message}`);

            const lowStockCount = stockData.filter(item => item.quantity <= item.min_quantity).length;
            setLowStockProducts(lowStockCount);

            const { data: monthlyOrders, error: monthlyOrdersError } = await supabase
                .from('orders')
                .select('total_amount, status')
                .gte('created_at', monthStart);

            if (monthlyOrdersError) throw new Error(`Erro ao buscar faturamento mensal: ${monthlyOrdersError.message}`);
            
            const monthlyRevenueSum = monthlyOrders
                .filter(order => order.status !== 'Cancelado')
                .reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0);
            setMonthlyRevenue(monthlyRevenueSum);

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Ocorreu um erro desconhecido.");
            }
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchDashboardData();
        const channel = supabase
            .channel('dashboard_realtime_all')
            .on('postgres_changes', { event: '*', schema: 'public' }, fetchDashboardData)
            .subscribe();
        
        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchDashboardData]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
                <div className="col-span-full text-center py-8 flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                    <p className="text-zinc-400 mt-2">Carregando estatísticas...</p>
                </div>
            ) : error ? (
                <div className="col-span-full text-center py-8 text-red-400 bg-red-900/20 rounded-lg">
                    <p className="font-semibold">Erro ao carregar dados:</p>
                    <p className="text-sm">{error}</p>
                </div>
            ) : (
                <>
                    <Card className="bg-[#2D2D2D] text-white border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-300">Pedidos Hoje</CardTitle>
                            <ShoppingBag className="h-4 w-4 text-zinc-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{ordersToday}</div>
                            <p className="text-xs text-zinc-400">Total de pedidos criados hoje</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#2D2D2D] text-white border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-300">Faturamento Hoje</CardTitle>
                            <DollarSign className="h-4 w-4 text-zinc-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(revenueToday)}</div>
                            <p className="text-xs text-zinc-400">Soma dos pedidos de hoje</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#2D2D2D] text-white border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-300">Estoque Baixo</CardTitle>
                            <Package className="h-4 w-4 text-zinc-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{lowStockProducts}</div>
                            <p className="text-xs text-zinc-400">Produtos abaixo do mínimo</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#2D2D2D] text-white border-zinc-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-300">Receita do Mês</CardTitle>
                            <TrendingUp className="h-4 w-4 text-zinc-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(monthlyRevenue)}</div>
                            <p className="text-xs text-zinc-400">Faturamento no mês atual</p>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}