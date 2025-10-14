"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Search } from "lucide-react"

interface CustomerInfo {
    phone: string;
}

interface Order {
    id: number;
    order_code: string;
    customer_name: string;
    total_amount: number;
    status: string;
    order_date: string | null;
    item_count: number;
    customers: CustomerInfo[] | null;
}

export function FutureOrdersTable() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClientComponentClient();

    const fetchFutureOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).toISOString();

            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('id, order_code, customer_name, total_amount, status, order_date, customers!inner(phone)')
                .gte('order_date', tomorrowStart.split('T')[0])
                .order('order_date', { ascending: true });

            if (ordersError) throw ordersError;

            const orderIds = ordersData.map(o => o.id);
            if (orderIds.length === 0) {
                setOrders([]);
                setLoading(false);
                return;
            }

            const { data: allItems, error: itemsError } = await supabase
                .from('order_items')
                .select('order_id, quantity')
                .in('order_id', orderIds);
            
            if (itemsError) throw itemsError;

            const itemsCountMap = new Map<number, number>();
            for (const item of allItems) {
                const currentCount = itemsCountMap.get(item.order_id) || 0;
                itemsCountMap.set(item.order_id, currentCount + item.quantity);
            }

            const combinedOrders: Order[] = ordersData.map(order => ({
                ...order,
                item_count: itemsCountMap.get(order.id) || 0,
            }));
            
            setOrders(combinedOrders);
        } catch (err: any) {
            setError(err.message || "Erro ao carregar pedidos futuros.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchFutureOrders();
        const channel = supabase
            .channel('future_orders_realtime_v3')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchFutureOrders)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchFutureOrders)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchFutureOrders]);
    
    const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'Entregue': return `bg-green-800/50 text-green-300 border-green-700/50 hover:bg-green-800/70`;
            case 'Cancelado': return `bg-red-800/50 text-red-300 border-red-700/50 hover:bg-red-800/70`;
            case 'Saiu para Entrega': return `bg-blue-800/50 text-blue-300 border-blue-700/50 hover:bg-blue-800/70`;
            case 'Em Separação': return `bg-yellow-800/50 text-zinc-300 border-yellow-700/50`;
            default: return `bg-zinc-700 text-zinc-300 border-zinc-600 hover:bg-zinc-600`;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }

    const filteredOrders = orders.filter(order =>
        order.order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customers && order.customers[0]?.phone && order.customers[0].phone.includes(searchTerm))
    );

    return (
        <div className="bg-[#2D2D2D] text-white border border-zinc-800 rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">Pedidos Futuros</h3>
                    <Badge variant="secondary" className="bg-zinc-700 text-zinc-300 border-zinc-600">{filteredOrders.length} total</Badge>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        type="search"
                        placeholder="Buscar pedidos..."
                        className="pl-9 w-full bg-[#1C1C1C] border-zinc-700 text-white placeholder:text-zinc-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="space-y-2">
                 <div className="hidden md:grid md:grid-cols-12 items-center gap-x-4 px-3 pb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="col-span-1 text-left">Pedido</div>
                    <div className="col-span-3 text-left">Cliente</div>
                    <div className="col-span-2 text-left">Telefone</div>
                    <div className="col-span-1 text-center">Itens</div>
                    <div className="col-span-1 text-center">Total</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-2 text-center">Entrega</div>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-zinc-400">Carregando...</div>
                ) : error ? (
                    <div className="text-center py-10 text-red-400">{error}</div>
                ) : filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => (
                        <div key={order.id} className="grid grid-cols-1 md:grid-cols-12 items-center gap-x-4 bg-neutral-950/40 p-3 rounded-md">
                            <div className="col-span-1 font-medium">{order.order_code}</div>
                            <div className="col-span-3">{order.customer_name}</div>
                            <div className="col-span-2">{order.customers?.[0]?.phone || 'N/A'}</div>
                            <div className="col-span-1 text-center">{order.item_count} {order.item_count === 1 ? 'item' : 'itens'}</div>
                            <div className="col-span-1 text-center">{formatCurrency(order.total_amount)}</div>
                            <div className="col-span-2 flex justify-center"><Badge className={getStatusBadgeClass(order.status)}>{order.status}</Badge></div>
                            <div className="col-span-2 text-center">{formatDate(order.order_date)}</div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 text-zinc-500">Nenhum pedido futuro encontrado.</div>
                )}
            </div>
        </div>
    )
}