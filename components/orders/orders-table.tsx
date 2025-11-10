"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Search, Loader2 } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface CustomerInfo {
    phone: string;
}

interface Order {
    id: number;
    order_code: string;
    customer_name: string;
    total_amount: number;
    status: string;
    delivery_time: string | null;
    order_date: string | null;
    item_count: number;
    customers: CustomerInfo[] | null;
}

export function OrdersTable() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'today' | 'future' | 'past'>('today');

    const supabase = createClientComponentClient();

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const today = new Date();
            const todayStr = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().split('T')[0];
            
            let query = supabase
                .from('orders')
                .select('id, order_code, customer_name, total_amount, status, order_date, delivery_time, customers!inner(phone)');

            if (view === 'today') {
                query = query
                    .eq('order_date', todayStr)
                    .order('delivery_time', { ascending: true });
            } else if (view === 'future') {
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const tomorrowStr = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).toISOString().split('T')[0];
                
                query = query
                    .gte('order_date', tomorrowStr)
                    .order('order_date', { ascending: true });
            } else if (view === 'past') {
                query = query
                    .lt('order_date', todayStr)
                    .order('order_date', { ascending: false });
            }

            const { data: ordersData, error: ordersError } = await query;

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
            setError(err.message || "Erro ao carregar pedidos.");
        } finally {
            setLoading(false);
        }
    }, [supabase, view]);

    useEffect(() => {
        fetchOrders();
        const channel = supabase
            .channel('dashboard_orders_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchOrders)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchOrders]);
    
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

    const getDeliveryInfo = (order: Order) => {
        if (view === 'today') {
            return order.delivery_time || 'N/A';
        }
        return formatDate(order.order_date);
    };

    const filteredOrders = orders.filter(order =>
        order.order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customers && order.customers[0]?.phone && order.customers[0].phone.includes(searchTerm))
    );

    const viewTitles = {
        today: "Pedidos Hoje",
        future: "Pedidos Futuros",
        past: "Pedidos Passados"
    }

    return (
        <div className="bg-[#2D2D2D] text-white border border-zinc-800 rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">{viewTitles[view]}</h3>
                    <Badge variant="secondary" className="bg-zinc-700 text-zinc-300 border-zinc-600">{filteredOrders.length} total</Badge>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <ToggleGroup
                        type="single"
                        value={view}
                        onValueChange={(value: 'today' | 'future' | 'past') => {
                            if (value) setView(value);
                        }}
                        className="w-full sm:w-auto"
                    >
                        <ToggleGroupItem value="past" className="text-xs text-zinc-400 data-[state=on]:bg-zinc-700 data-[state=on]:text-white flex-1">
                            Passados
                        </ToggleGroupItem>
                        <ToggleGroupItem value="today" className="text-xs text-zinc-400 data-[state=on]:bg-zinc-700 data-[state=on]:text-white flex-1">
                            Hoje
                        </ToggleGroupItem>
                        <ToggleGroupItem value="future" className="text-xs text-zinc-400 data-[state=on]:bg-zinc-700 data-[state=on]:text-white flex-1">
                            Futuros
                        </ToggleGroupItem>
                    </ToggleGroup>

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
            </div>
            
            <div className="space-y-2">
                 <div className="hidden md:grid md:grid-cols-12 items-center gap-x-4 px-3 pb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="col-span-1 text-left">Pedido</div>
                    <div className="col-span-3 text-left">Cliente</div>
                    <div className="col-span-2 text-left">Telefone</div>
                    <div className="col-span-1 text-center">Itens</div>
                    <div className="col-span-1 text-center">Total</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-2 text-center">{view === 'today' ? 'Horário' : 'Data Entrega'}</div>
                </div>
                <div className="h-96 overflow-y-auto pr-2 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-zinc-400 gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-red-400">
                            {error}
                        </div>
                    ) : filteredOrders.length > 0 ? (
                        filteredOrders.map((order) => (
                            <div key={order.id} className="grid grid-cols-1 md:grid-cols-12 items-center gap-x-4 bg-neutral-950/40 p-3 rounded-md">
                                <div className="col-span-1 font-medium">{order.order_code}</div>
                                <div className="col-span-3">{order.customer_name}</div>
                                <div className="col-span-2">{order.customers?.[0]?.phone || 'N/A'}</div>
                                <div className="col-span-1 text-center">{order.item_count} {order.item_count === 1 ? 'item' : 'itens'}</div>
                                <div className="col-span-1 text-center">{formatCurrency(order.total_amount)}</div>
                                <div className="col-span-2 flex justify-center"><Badge className={getStatusBadgeClass(order.status)}>{order.status}</Badge></div>
                                <div className="col-span-2 text-center">{getDeliveryInfo(order)}</div>
                            </div>
                        ))
                    ) : (
                        <div className="flex items-center justify-center h-full text-zinc-500">
                            Nenhum pedido encontrado.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}