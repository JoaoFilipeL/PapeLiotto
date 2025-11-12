"use client"
import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Loader2, Users, MoreVertical, FileDown, Printer, Filter, Check, X, Eye } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils";
import { Order, Customer, Budget, CurrentUser } from "./types/orders" 
import { Product as StockProduct } from "../stock/types/stock" 
import { handlePrint, handleSaveAsPdf } from "./order-print-utils"
import { AddOrderDialog, EditOrderDialog, OrderDetailsDialog } from "./order-modals"
import { toast } from "sonner"

export function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<StockProduct[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [availableBudgets, setAvailableBudgets] = useState<Budget[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [statusFilter, setStatusFilter] = useState<string>("todos");
    const [nextOrderCode, setNextOrderCode] = useState("");

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

    const supabase = createClientComponentClient();

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        fetchUser();
    }, [supabase]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: customersData, error: customersError } = await supabase.from('customers').select('*').eq('is_archived', false).order('name');
            if (customersError) throw customersError;
            setCustomers(customersData);

            const { data: productsData, error: productsError } = await supabase.from('stock').select('*').eq('is_archived', false).order('name');
            if (productsError) throw productsError;
            setProducts(productsData.map(p => ({ ...p, price: parseFloat(p.price as any) })));

            const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').eq('is_archived', false).order('created_at', { ascending: sortOrder === 'asc' });
            if (ordersError) throw ordersError;
            
            const orderIds = ordersData.map(o => o.id);
            if(orderIds.length > 0) {
                const { data: itemsData, error: itemsError } = await supabase.from('order_items').select('*').in('order_id', orderIds);
                if (itemsError) throw itemsError;
                const combinedOrders: Order[] = ordersData.map(order => {
                    const customer = customersData.find(c => c.id === order.customer_id);
                    return { ...order, customer_phone: customer?.phone, total_amount: parseFloat(order.total_amount as any), items: itemsData.filter(item => item.order_id === order.id).map(item => ({ ...item, unit_price: parseFloat(item.unit_price as any) })) }
                });
                setOrders(combinedOrders);
            } else {
                setOrders([]);
            }

            const { data: lastOrderData, error: lastOrderError } = await supabase.from('orders').select('order_code').order('created_at', { ascending: false }).limit(1).single();
            const lastId = lastOrderData ? parseInt(lastOrderData.order_code.split('-')[1]) : 0;
            setNextOrderCode(`PED-${(lastId + 1).toString().padStart(4, '0')}`);

            const { data: budgetsData, error: budgetsError } = await supabase.from('budgets').select('*').is('deleted_at', null).order('created_at', { ascending: false });
            if (budgetsError) throw budgetsError;

            const budgetIds = budgetsData.map(b => b.id);
            if (budgetIds.length > 0) {
                const { data: budgetItemsData, error: budgetItemsError } = await supabase.from('budget_items').select('*').in('budget_id', budgetIds);
                if (budgetItemsError) throw budgetItemsError;

                const combinedBudgets: Budget[] = budgetsData.map(budget => ({
                    ...budget,
                    items: budgetItemsData.filter(item => item.budget_id === budget.id).map(item => ({
                        product_id: item.product_id,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_price: parseFloat(item.unit_price as any)
                    }))
                }));
                setAvailableBudgets(combinedBudgets);
            }

        } catch (err) {
            setError("Falha ao carregar dados.");
            toast.error("Falha ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [supabase, sortOrder]);

    useEffect(() => {
        fetchData();
        const channel = supabase.channel('orders_realtime')
            .on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, [supabase, fetchData]);
    
    const handleStatusChange = async (order: Order, newStatus: string) => {
        if (order.status === newStatus) return;
        setError(null);
        
        try {
            const { error } = await supabase.rpc('update_order_status_and_stock', {
                order_id_input: order.id,
                new_status_input: newStatus
            });

            if (error) throw error;
            
            toast.success(`Pedido ${order.order_code} atualizado para ${newStatus}`);
        } catch (err) {
            if (err instanceof Error) setError(err.message);
            else setError("Ocorreu um erro desconhecido ao atualizar o status.");
            toast.error("Erro ao atualizar status.");
        }
    };
    
    const openDetailsDialog = (order: Order) => { setSelectedOrderDetails(order); setIsDetailsDialogOpen(true); };
    const openEditDialog = (order: Order) => { setEditingOrder(order); setIsEditDialogOpen(true); };
    
    const filteredOrders = orders
        .filter(o => 
            (o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             o.order_code.toLowerCase().includes(searchTerm.toLowerCase())) || 
            (o.customer_phone && o.customer_phone.includes(searchTerm))
        )
        .filter(o => 
            statusFilter === 'todos' ? true : o.status === statusFilter
        )
        .sort((a, b) => {
            const isAInactive = a.status === 'Cancelado' || a.status === 'Entregue';
            const isBInactive = b.status === 'Cancelado' || b.status === 'Entregue';

            if (isAInactive && !isBInactive) return 1;
            if (!isAInactive && isBInactive) return -1;
            
            if (isAInactive && isBInactive) {
                if (a.status === 'Entregue' && b.status === 'Cancelado') return -1;
                if (a.status === 'Cancelado' && b.status === 'Entregue') return 1;
            }
            
            if(sortOrder === 'desc') {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            } else {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }
        });

    const getStatusBadgeClass = (status: string): string => {
        const baseClasses = "text-center border text-xs font-semibold rounded-md px-2.5 py-1 transition-colors justify-start cursor-pointer";
        switch (status) {
            case 'Entregue': return `${baseClasses} bg-green-800/50 text-zinc-300 border-green-700/50`;
            case 'Cancelado': return `${baseClasses} bg-red-800/50 text-zinc-300 border-red-700/50`;
            case 'Saiu para Entrega': return `${baseClasses} bg-blue-800/50 text-zinc-300 border-blue-700/50`;
            case 'Em Separação': return `${baseClasses} bg-yellow-800/50 text-zinc-300 border-yellow-700/50`;
            case 'Pronto': return `${baseClasses} bg-cyan-800/50 text-zinc-300 border-cyan-700/50`;
            default: return `${baseClasses} bg-zinc-800 text-zinc-300 border-zinc-700`;
        }
    };

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                <h1 className="text-white text-3xl font-bold">Pedidos</h1>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 w-full md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" /><Input type="search" placeholder="Buscar pedidos..." className="pl-10 w-full bg-[#1C1C1C] text-white border-zinc-600 placeholder:text-zinc-500 rounded-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer">
                                <Filter className="h-4 w-4" />
                                Filtrar
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 bg-zinc-800 text-white border-zinc-700" align="end">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Ordenar por Data</h4>
                                    <RadioGroup
                                        value={sortOrder}
                                        onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}
                                        className="grid gap-2"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="desc" id="r-desc" className="border-zinc-600 text-white" />
                                            <Label htmlFor="r-desc">Mais Recentes</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="asc" id="r-asc" className="border-zinc-600 text-white" />
                                            <Label htmlFor="r-asc">Mais Antigos</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <Separator className="bg-zinc-600" />
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Filtrar por Status</h4>
                                    <RadioGroup value={statusFilter} onValueChange={setStatusFilter} className="grid gap-2">
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="todos" id="r-todos" className="border-zinc-600 text-white" /><Label htmlFor="r-todos">Todos os Status</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Pendente" id="r-pendente" className="border-zinc-600 text-white" /><Label htmlFor="r-pendente">Pendente</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Em Separação" id="r-separacao" className="border-zinc-600 text-white" /><Label htmlFor="r-separacao">Em Separação</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Pronto" id="r-pronto" className="border-zinc-600 text-white" /><Label htmlFor="r-pronto">Pronto</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Saiu para Entrega" id="r-entrega" className="border-zinc-600 text-white" /><Label htmlFor="r-entrega">Saiu para Entrega</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Entregue" id="r-entregue" className="border-zinc-600 text-white" /><Label htmlFor="r-entregue">Entregue</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Cancelado" id="r-cancelado" className="border-zinc-600 text-white" /><Label htmlFor="r-cancelado">Cancelado</Label></div>
                                    </RadioGroup>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer" onClick={() => setIsAddDialogOpen(true)}><Plus className="h-5 w-5" />Adicionar Pedido</Button>
                </div>
            </div>

            {loading && <div className="text-center text-white py-8"><Loader2 className="h-10 w-10 animate-spin text-white mx-auto" /><p className="mt-3">Carregando...</p></div>}
            {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md mb-4">{error}</div>}

            {!loading && !error && filteredOrders.length > 0 && (
                <div className="hidden md:grid md:grid-cols-12 items-center gap-x-4 px-3 pb-2 mb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="col-span-1 text-left">Pedido</div>
                    <div className="col-span-2 text-left">Cliente</div>
                    <div className="col-span-2 text-left">Telefone</div>
                    <div className="col-span-1 text-left">Pagamento</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-2 text-left">Entrega</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1 text-right">Ações</div>
                </div>
            )}

            <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-2">
                {!loading && filteredOrders.map(order => (
                    <div 
                        key={order.id} 
                        className={cn(
                            "grid grid-cols-1 md:grid-cols-12 items-center gap-x-4 bg-[#1C1C1C] p-3 rounded-lg transition-colors duration-200 text-sm",
                            (order.status === 'Cancelado' || order.status === 'Entregue')
                                ? 'opacity-60 cursor-default' 
                                : 'cursor-pointer hover:bg-zinc-800'
                        )}
                        onClick={() => {
                            if (order.status !== 'Cancelado' && order.status !== 'Entregue') {
                                openEditDialog(order);
                            }
                        }}
                    >
                        <div className="col-span-1 text-left text-white font-medium truncate">{order.order_code}</div>
                        <div className="md:col-span-2 text-left text-zinc-300 truncate">{order.customer_name}</div>
                        <div className="md:col-span-2 text-left text-zinc-400 truncate">{order.customer_phone || 'N/A'}</div>
                        <div className="md:col-span-1 text-left text-zinc-300 truncate">{order.payment_method}</div>
                        <div className="md:col-span-2 flex justify-center items-center">
                            {order.status === 'Cancelado' ? (
                                <Button
                                    variant="ghost"
                                    className="flex items-center text-xs font-semibold text-red-500 hover:bg-red-900/50 hover:text-red-400 h-8 px-3 w-[150px] justify-center"
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(order, 'Pendente'); }}
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Reativar
                                </Button>
                            ) : order.status === 'Entregue' ? (
                                <Button
                                    variant="ghost"
                                    className="flex items-center text-xs font-semibold text-green-500 hover:bg-green-900/50 hover:text-green-400 h-8 px-3 w-[150px] justify-center"
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(order, 'Pendente'); }}
                                >
                                    <Check className="h-4 w-4 mr-1" />
                                    Reativar
                                </Button>
                            ) : (
                                <Select value={order.status} onValueChange={(newStatus) => handleStatusChange(order, newStatus)}>
                                    <SelectTrigger className={cn(getStatusBadgeClass(order.status), "w-[150px]")} onClick={(e) => e.stopPropagation()}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                        <SelectItem className="cursor-pointer" value="Pendente">Pendente</SelectItem>
                                        <SelectItem className="cursor-pointer" value="Em Separação">Em Separação</SelectItem>
                                        <SelectItem className="cursor-pointer" value="Pronto">Pronto</SelectItem>
                                        <SelectItem className="cursor-pointer" value="Saiu para Entrega">Saiu para Entrega</SelectItem>
                                        <SelectItem className="cursor-pointer" value="Entregue">Entregue</SelectItem>
                                        <SelectItem className="cursor-pointer" value="Cancelado">Cancelado</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <div className="md:col-span-2 text-left text-zinc-400 truncate">{new Date(order.order_date + 'T00:00:00').toLocaleDateString('pt-BR')} às {order.delivery_time}</div>
                        <div className="md:col-span-1 text-right text-white font-semibold truncate">{order.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div className="md:col-span-1 flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="cursor-pointer hover:bg-zinc-700" onClick={() => openDetailsDialog(order)}>
                                <Eye className="h-5 w-5 text-zinc-400" />
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="cursor-pointer hover:bg-zinc-700" disabled={order.status === 'Cancelado' || order.status === 'Entregue'}>
                                        <MoreVertical className="h-5 w-5 text-zinc-400" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-zinc-800 text-white border-zinc-700">
                                    <DropdownMenuItem className="cursor-pointer focus:bg-zinc-700 focus:text-white" onSelect={() => handleSaveAsPdf(order)}><FileDown className="mr-2 h-4 w-4" />Salvar em PDF</DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer focus:bg-zinc-700 focus:text-white" onSelect={() => handlePrint(order)}><Printer className="mr-2 h-4 w-4" />Imprimir</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}
                {!loading && filteredOrders.length === 0 && !error && (<div className="text-center text-zinc-500 py-10">Nenhum pedido encontrado.</div>)}
            </div>

            <div className="flex justify-end mt-6">
                <Link href="/orders/customers" passHref>
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer">
                        <Users className="h-5 w-5" />
                        Gerenciar Clientes
                    </Button>
                </Link>
            </div>

            <AddOrderDialog
                isOpen={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                nextOrderCode={nextOrderCode}
                customers={customers}
                products={products}
                availableBudgets={availableBudgets}
                currentUser={currentUser}
                onOrderCreated={fetchData}
            />

            <EditOrderDialog
                isOpen={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                editingOrder={editingOrder}
                customers={customers}
                products={products}
                onOrderUpdated={fetchData}
                onOrderDeleted={fetchData}
            />

            <OrderDetailsDialog
                isOpen={isDetailsDialogOpen}
                onOpenChange={setIsDetailsDialogOpen}
                order={selectedOrderDetails}
            />
        </div>
    );
}