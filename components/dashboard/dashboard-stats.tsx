"use client"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingBag, DollarSign, Package, TrendingUp } from "lucide-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Loader2 } from "lucide-react";

type OrderStatus = "em análise" | "em produção" | "pronto" | "cancelado";
type TransactionType = "receita" | "despesa";
type TransactionCategory = "venda" | "compra" | "outros";

interface Order {
    id: string;
    status: OrderStatus;
    total_amount: number;
    created_at: string;
    delivery_date: string;
}

interface Transaction {
    id: string;
    transaction_date: string;
    amount: number;
    type: TransactionType;
    category: TransactionCategory;
}

interface StockItem {
    id: string;
    quantity: number;
    min_quantity: number;
}

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
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const todayFormatted = today.toISOString().split('T')[0];
            const tomorrowFormatted = tomorrow.toISOString().split('T')[0];

            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);
            const startOfMonthISO = startOfMonth.toISOString();
            const endOfMonthISO = endOfMonth.toISOString();

            // Fetch Orders
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('id, status, total_amount, created_at, delivery_date')
                .gte('delivery_date', todayFormatted)
                .lt('delivery_date', tomorrowFormatted);

            if (ordersError) {
                console.error('Erro ao buscar pedidos:', ordersError);
                throw new Error(`Erro ao buscar pedidos: ${ordersError.message}`);
            }

            const ordersCountToday = ordersData.filter(
                order => order.status === 'em produção' || order.status === 'pronto'
            ).length;
            setOrdersToday(ordersCountToday);

            const revenueSumToday = ordersData.filter(order => order.status === 'pronto')
                .reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0);
            setRevenueToday(revenueSumToday);

            // Fetch Stock
            const { data: stockData, error: stockError } = await supabase
                .from('stock')
                .select('quantity, min_quantity');

            if (stockError) {
                console.error('Erro ao buscar estoque:', stockError);
                throw new Error(`Erro ao buscar estoque: ${stockError.message}`);
            }

            const lowStockCount = stockData.filter(item => item.quantity <= item.min_quantity).length;
            setLowStockProducts(lowStockCount);

            // Fetch Financial Transactions
            const { data: transactionsData, error: transactionsError } = await supabase
                .from('financial_transactions')
                .select('amount, type, transaction_date')
                .gte('transaction_date', startOfMonthISO.split('T')[0])
                .lte('transaction_date', endOfMonthISO.split('T')[0]);

            if (transactionsError) {
                console.error('Erro ao buscar transações financeiras:', transactionsError);
                throw new Error(`Erro ao buscar transações financeiras: ${transactionsError.message}`);
            }

            const monthlyRevenueSum = transactionsData
                .filter(t => t.type === 'receita')
                .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

            setMonthlyRevenue(monthlyRevenueSum);

        } catch (err: unknown) {
            console.error("Erro geral no DashboardStats:", err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Ocorreu um erro desconhecido ao carregar dados do dashboard.");
            }
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchDashboardData();

        const ordersChannel = supabase
            .channel('dashboard_orders_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => {
                    console.log('Mudança em pedidos para dashboard em tempo real!', payload);
                    fetchDashboardData();
                }
            )
            .subscribe();

        const financialChannel = supabase
            .channel('dashboard_financial_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'financial_transactions' },
                (payload) => {
                    console.log('Mudança em finanças para dashboard em tempo real!', payload);
                    fetchDashboardData();
                }
            )
            .subscribe();

        const stockChannel = supabase
            .channel('dashboard_stock_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'stock' },
                (payload) => {
                    console.log('Mudança no estoque para dashboard em tempo real!', payload);
                    fetchDashboardData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(financialChannel);
            supabase.removeChannel(stockChannel);
        };
    }, [supabase, fetchDashboardData]);

    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
            {loading ? (
                <div className="col-span-full text-center py-8 flex flex-col items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                    <p className="text-white mt-3 text-lg">Carregando estatísticas...</p>
                </div>
            ) : error ? (
                <div className="col-span-full text-center py-8 text-red-500 text-lg">
                    Erro ao carregar dados: {error}
                </div>
            ) : (
                <>
                    <Card className="w-full h-full flex flex-col justify-between bg-zinc-800 text-white border-zinc-700 rounded-lg shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                            <CardTitle className="text-sm font-medium text-zinc-300">Pedidos Hoje</CardTitle>
                            <ShoppingBag className="h-5 w-5 text-zinc-400" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold">{ordersToday}</div>
                            <p className="text-xs text-zinc-400 mt-1">Pedidos em produção ou prontos</p>
                        </CardContent>
                    </Card>

                    <Card className="w-full h-full flex flex-col justify-between bg-zinc-800 text-white border-zinc-700 rounded-lg shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                            <CardTitle className="text-sm font-medium text-zinc-300">Faturamento Hoje</CardTitle>
                            <DollarSign className="h-5 w-5 text-zinc-400" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold">$ {revenueToday.toFixed(2)}</div>
                            <p className="text-xs text-zinc-400 mt-1">Total de pedidos prontos</p>
                        </CardContent>
                    </Card>

                    <Card className="w-full h-full flex flex-col justify-between bg-zinc-800 text-white border-zinc-700 rounded-lg shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                            <CardTitle className="text-sm font-medium text-zinc-300">Estoque Baixo</CardTitle>
                            <Package className="h-5 w-5 text-zinc-400" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold">{lowStockProducts}</div>
                            <p className="text-xs text-zinc-400 mt-1">Produtos com estoque crítico</p>
                        </CardContent>
                    </Card>

                    <Card className="w-full h-full flex flex-col justify-between bg-zinc-800 text-white border-zinc-700 rounded-lg shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                            <CardTitle className="text-sm font-medium text-zinc-300">Receita Total (Mês)</CardTitle>
                            <TrendingUp className="h-5 w-5 text-zinc-400" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-3xl font-bold">$ {monthlyRevenue.toFixed(2)}</div>
                            <p className="text-xs text-zinc-400 mt-1">Dados do mês atual</p>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
