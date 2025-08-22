"use client"
import type React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Loader2, Edit, Trash2, Archive, Eye, Minus, Users } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

interface Product {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

interface Customer {
    id: string;
    name: string;
    phone?: string;
    address?: string;
}

interface OrderItem {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
}

interface Order {
    id: number;
    order_code: string;
    customer_id: string;
    customer_name: string;
    customer_phone?: string;
    address: string;
    order_date: string;
    payment_method: string;
    total_amount: number;
    items: OrderItem[];
    notes: string | null;
    delivery_time: string | null;
    delivery_fee: number;
}

export function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Add States
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [addFormError, setAddFormError] = useState<string | null>(null);
    const [nextOrderCode, setNextOrderCode] = useState("");
    const [addSelectedCustomerId, setAddSelectedCustomerId] = useState<string>("");
    const [addAddress, setAddAddress] = useState("");
    const [addOrderDate, setAddOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [addPaymentMethod, setAddPaymentMethod] = useState<string>("");
    const [addOrderItems, setAddOrderItems] = useState<OrderItem[]>([]);
    const [addSelectedProductId, setAddSelectedProductId] = useState<string>("");
    const [addItemQuantity, setAddItemQuantity] = useState(1);
    const [addNotes, setAddNotes] = useState("");
    const [addDeliveryTime, setAddDeliveryTime] = useState("12:00");
    const [addDeliveryFee, setAddDeliveryFee] = useState("0");

    // Edit States
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [editCustomerId, setEditCustomerId] = useState<string>("");
    const [editAddress, setEditAddress] = useState("");
    const [editOrderDate, setEditOrderDate] = useState("");
    const [editPaymentMethod, setEditPaymentMethod] = useState("");
    const [editOrderItems, setEditOrderItems] = useState<OrderItem[]>([]);
    const [editSelectedProductId, setEditSelectedProductId] = useState<string>("");
    const [editItemQuantity, setEditItemQuantity] = useState(1);
    const [editNotes, setEditNotes] = useState("");
    const [editDeliveryTime, setEditDeliveryTime] = useState("12:00");
    const [editDeliveryFee, setEditDeliveryFee] = useState("0");
    const [editFormError, setEditFormError] = useState<string | null>(null);

    // Details States
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);

    const supabase = createClientComponentClient();

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: customersData, error: customersError } = await supabase.from('customers').select('*').order('name');
            if (customersError) throw customersError;
            setCustomers(customersData);

            const { data: productsData, error: productsError } = await supabase.from('stock').select('*').order('name');
            if (productsError) throw productsError;
            setProducts(productsData.map(p => ({ ...p, price: parseFloat(p.price as any) })));

            const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
            if (ordersError) throw ordersError;

            const orderIds = ordersData.map(o => o.id);
            const { data: itemsData, error: itemsError } = await supabase.from('order_items').select('*').in('order_id', orderIds);
            if (itemsError) throw itemsError;

            const combinedOrders: Order[] = ordersData.map(order => {
                const customer = customersData.find(c => c.id === order.customer_id);
                return {
                    ...order,
                    customer_phone: customer?.phone,
                    total_amount: parseFloat(order.total_amount as any),
                    items: itemsData.filter(item => item.order_id === order.id).map(item => ({...item, unit_price: parseFloat(item.unit_price as any)}))
                }
            });
            
            setOrders(combinedOrders);

            const lastId = ordersData.length > 0 ? Math.max(...ordersData.map(o => parseInt(o.order_code.split('-')[1]))) : 0;
            setNextOrderCode(`PED-${(lastId + 1).toString().padStart(4, '0')}`);
        } catch (err) {
            setError("Falha ao carregar dados.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchData();
        const channel = supabase.channel('orders_realtime').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [supabase, fetchData]);

    useEffect(() => {
        if (addSelectedCustomerId) {
            const customer = customers.find(c => c.id === addSelectedCustomerId);
            if (customer) {
                setAddAddress(customer.address || "");
            }
        } else {
            setAddAddress("");
        }
    }, [addSelectedCustomerId, customers]);

    const calculateTotal = (items: OrderItem[], fee: string) => {
        const itemsTotal = items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
        const deliveryFee = parseFloat(fee) || 0;
        return itemsTotal + deliveryFee;
    };

    const resetAddForm = () => {
        setAddSelectedCustomerId("");
        setAddAddress("");
        setAddOrderDate(new Date().toISOString().split('T')[0]);
        setAddPaymentMethod("");
        setAddOrderItems([]);
        setAddSelectedProductId("");
        setAddItemQuantity(1);
        setAddNotes("");
        setAddDeliveryTime("12:00");
        setAddDeliveryFee("0");
        setAddFormError(null);
    };

    const handleCreateOrder = async () => {
        if (!addSelectedCustomerId || addOrderItems.length === 0 || !addPaymentMethod) {
            setAddFormError("Preencha: Cliente, Forma de Pagamento e adicione ao menos um item.");
            return;
        }
        setLoading(true);
        setAddFormError(null);
        try {
            for (const item of addOrderItems) {
                const productInStock = products.find(p => p.id === item.product_id);
                if (!productInStock || productInStock.quantity < item.quantity) {
                    throw new Error(`Estoque insuficiente para "${item.product_name}".`);
                }
            }
            const customer = customers.find(c => c.id === addSelectedCustomerId);
            if (!customer) throw new Error("Cliente não encontrado.");
            
            const total_amount = calculateTotal(addOrderItems, addDeliveryFee);
            
            const { data: orderData, error: orderError } = await supabase
                .from('orders').insert({
                    order_code: nextOrderCode,
                    customer_id: addSelectedCustomerId,
                    customer_name: customer.name,
                    address: addAddress,
                    order_date: addOrderDate,
                    payment_method: addPaymentMethod,
                    total_amount: total_amount,
                    notes: addNotes,
                    delivery_time: addDeliveryTime,
                    delivery_fee: parseFloat(addDeliveryFee) || 0,
                }).select().single();

            if (orderError) throw orderError;

            const itemsToInsert = addOrderItems.map(item => ({
                order_id: orderData.id, ...item
            }));
            const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            for (const item of addOrderItems) {
                const product = products.find(p => p.id === item.product_id);
                const newQuantity = (product?.quantity || 0) - item.quantity;
                const { error: stockUpdateError } = await supabase.from('stock').update({ quantity: newQuantity }).eq('id', item.product_id);
                if (stockUpdateError) throw new Error(`Falha ao atualizar estoque para ${item.product_name}.`);
            }
            setIsAddDialogOpen(false);
            resetAddForm();
        } catch (err) {
            if (err instanceof Error) setAddFormError(err.message);
            else setAddFormError("Ocorreu um erro desconhecido.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateOrder = async () => {
        if (!editingOrder || !editCustomerId || editOrderItems.length === 0) {
            setEditFormError("Cliente e itens são obrigatórios.");
            return;
        }
        setLoading(true);
        setEditFormError(null);
    
        try {
            const originalItems = editingOrder.items;
            const stockAdjustments = new Map<string, number>();
    
            originalItems.forEach(item => {
                stockAdjustments.set(item.product_id, (stockAdjustments.get(item.product_id) || 0) + item.quantity);
            });
            editOrderItems.forEach(item => {
                stockAdjustments.set(item.product_id, (stockAdjustments.get(item.product_id) || 0) - item.quantity);
            });
    
            for (const [productId, quantityChange] of stockAdjustments.entries()) {
                if (quantityChange !== 0) {
                    const product = products.find(p => p.id === productId);
                    if (product) {
                        const newStock = product.quantity + quantityChange;
                        if (newStock < 0) throw new Error(`Estoque insuficiente para "${product.name}".`);
                        const { error } = await supabase.from('stock').update({ quantity: newStock }).eq('id', productId);
                        if(error) throw error;
                    }
                }
            }
    
            const customer = customers.find(c => c.id === editCustomerId);
            if (!customer) throw new Error("Cliente não encontrado.");
    
            const total_amount = calculateTotal(editOrderItems, editDeliveryFee);
            const { error: orderUpdateError } = await supabase.from('orders').update({
                customer_id: editCustomerId,
                customer_name: customer.name,
                address: editAddress,
                order_date: editOrderDate,
                payment_method: editPaymentMethod,
                total_amount,
                notes: editNotes,
                delivery_time: editDeliveryTime,
                delivery_fee: parseFloat(editDeliveryFee) || 0,
            }).eq('id', editingOrder.id);
            if(orderUpdateError) throw orderUpdateError;
    
            await supabase.from('order_items').delete().eq('order_id', editingOrder.id);
            const itemsToInsert = editOrderItems.map(item => ({ order_id: editingOrder.id, ...item }));
            await supabase.from('order_items').insert(itemsToInsert);
            
            setIsEditDialogOpen(false);
        } catch (err) {
            if (err instanceof Error) setEditFormError(err.message);
            else setEditFormError("Ocorreu um erro desconhecido.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOrder = async (orderId: number) => {
        if (!window.confirm("Tem certeza que deseja excluir este pedido? O estoque dos itens será revertido.")) return;
        setLoading(true);
        try {
            const orderToDelete = orders.find(o => o.id === orderId);
            if (!orderToDelete) throw new Error("Pedido não encontrado.");

            for (const item of orderToDelete.items) {
                const product = products.find(p => p.id === item.product_id);
                if (product) {
                    const newQuantity = product.quantity + item.quantity;
                    await supabase.from('stock').update({ quantity: newQuantity }).eq('id', item.product_id);
                }
            }
            const { error } = await supabase.from('orders').delete().eq('id', orderId);
            if (error) throw error;
            setIsEditDialogOpen(false);
        } catch (err) {
            if (err instanceof Error) setEditFormError(err.message);
            else setEditFormError("Ocorreu um erro desconhecido ao excluir.");
        } finally {
            setLoading(false);
        }
    };

    const openDetailsDialog = (order: Order) => {
        setSelectedOrderDetails(order);
        setIsDetailsDialogOpen(true);
    };

    const openEditDialog = (order: Order) => {
        setEditingOrder(order);
        setEditCustomerId(order.customer_id);
        setEditAddress(order.address || "");
        setEditOrderDate(order.order_date);
        setEditPaymentMethod(order.payment_method);
        setEditOrderItems(order.items);
        setEditNotes(order.notes || "");
        setEditDeliveryTime(order.delivery_time || "12:00");
        setEditDeliveryFee(order.delivery_fee?.toString() || "0");
        setEditFormError(null);
        setEditSelectedProductId("");
        setEditItemQuantity(1);
        setIsEditDialogOpen(true);
    };
    
    const handleAddItemToList = (list: OrderItem[], setList: React.Dispatch<React.SetStateAction<OrderItem[]>>, productId: string, quantity: number, setProductId: (id: string) => void, setQuantity: (q: number) => void, setErrorFunc: (e: string | null) => void) => {
        setErrorFunc(null);
        if (!productId) {
            setErrorFunc("Selecione um produto para adicionar.");
            return;
        }
        const product = products.find(p => p.id === productId);
        if (!product) {
            setErrorFunc("Produto não encontrado.");
            return;
        }

        const existingItem = list.find(item => item.product_id === product.id);
        const totalQuantityInOrder = existingItem ? existingItem.quantity : 0;

        if (product.quantity < totalQuantityInOrder + quantity) {
            setErrorFunc(`Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}`);
            return;
        }

        if (existingItem) {
            setList(list.map(item => 
                item.product_id === product.id 
                ? { ...item, quantity: item.quantity + quantity } 
                : item
            ));
        } else {
            setList([...list, {
                product_id: product.id,
                product_name: product.name,
                quantity: quantity,
                unit_price: product.price
            }]);
        }
        setProductId("");
        setQuantity(1);
    };

    const handleRemoveItemFromList = (list: OrderItem[], setList: React.Dispatch<React.SetStateAction<OrderItem[]>>, productId: string) => {
        setList(list.filter(item => item.product_id !== productId));
    };

    const filteredOrders = orders.filter(o =>
        (o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.order_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.customer_phone && o.customer_phone.includes(searchTerm))
    );

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                <h1 className="text-white text-3xl font-bold">Pedidos</h1>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input type="search" placeholder="Buscar pedidos..." className="pl-10 w-full bg-[#1C1C1C] text-white border-zinc-600 placeholder:text-zinc-500 rounded-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Link href="/orders/customers" passHref>
                        <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer">
                            <Users className="h-5 w-5" />
                            Gerenciar Clientes
                        </Button>
                    </Link>
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer" onClick={() => setIsAddDialogOpen(true)}>
                        <Archive className="h-5 w-5" />
                        Adicionar Pedido
                    </Button>
                </div>
            </div>

            {loading && <div className="text-center text-white py-8"><Loader2 className="h-10 w-10 animate-spin text-white mx-auto" /><p className="mt-3">Carregando...</p></div>}
            {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md">{error}</div>}

            {!loading && !error && filteredOrders.length > 0 && (
                <div className="hidden md:flex items-center px-3 pb-2 mb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="flex-1 text-left pr-4">Pedido</div>
                    <div className="flex-1 text-left pr-4">Cliente</div>
                    <div className="flex-1 text-left pr-4">Telefone</div>
                    <div className="flex-1 text-left pr-4">Endereço</div>
                    <div className="w-20 text-left pr-4">Itens</div>
                    <div className="flex-1 text-left pr-4">Pagamento</div>
                    <div className="flex-1 text-right pr-4">Total</div>
                    <div className="w-12"></div>
                </div>
            )}
            
            <div className="space-y-2">
                {!loading && filteredOrders.map(order => (
                    <div key={order.id} className="grid grid-cols-3 md:flex items-center bg-[#1C1C1C] p-3 rounded-lg hover:bg-zinc-800 transition-colors duration-200 cursor-pointer" onClick={() => openEditDialog(order)}>
                        <div className="md:flex-1 text-left pr-4 text-white font-medium truncate col-span-2"><span className="md:hidden font-semibold text-zinc-400">Pedido: </span>{order.order_code}</div>
                        <div className="md:flex-1 text-left pr-4 text-zinc-400 truncate"><span className="md:hidden font-semibold">Cliente: </span>{order.customer_name}</div>
                        <div className="md:flex-1 text-left pr-4 text-zinc-400 truncate"><span className="md:hidden font-semibold">Telefone: </span>{order.customer_phone || 'N/A'}</div>
                        <div className="md:flex-1 text-left pr-4 text-zinc-400 truncate col-span-3"><span className="md:hidden font-semibold">Endereço: </span>{order.address}</div>
                        <div className="md:w-20 text-left pr-4 text-zinc-400 truncate"><span className="md:hidden font-semibold">Itens: </span>{order.items.reduce((acc, item) => acc + item.quantity, 0)}</div>
                        <div className="md:flex-1 text-left pr-4 text-zinc-400 truncate"><span className="md:hidden font-semibold">Pgto: </span>{order.payment_method}</div>
                        <div className="md:flex-1 text-right pr-4 text-white font-semibold truncate col-span-3 md:col-span-1"><span className="md:hidden font-semibold text-zinc-400">Total: </span>{order.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div className="w-12 text-center hidden md:block">
                            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); openDetailsDialog(order); }}>
                                <Eye className="h-5 w-5 text-zinc-400" />
                            </Button>
                        </div>
                    </div>
                ))}
                {!loading && filteredOrders.length === 0 && !error && (
                    <div className="text-center text-zinc-500 py-10">Nenhum pedido encontrado.</div>
                )}
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={(isOpen) => { setIsAddDialogOpen(isOpen); if (!isOpen) resetAddForm(); }}>
                <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Adicionar Novo Pedido: {nextOrderCode}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-1 md:col-span-2">
                                <Label>Cliente</Label>
                                <Select value={addSelectedCustomerId} onValueChange={setAddSelectedCustomerId}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                                    <SelectContent>
                                        {customers.map(c => 
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name} ({c.phone || 'Sem telefone'})
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Data de Entrega</Label>
                                <Input type="date" value={addOrderDate} onChange={e => setAddOrderDate(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                            </div>
                            <div className="space-y-2">
                                <Label>Hora da Entrega</Label>
                                <Input type="time" value={addDeliveryTime} onChange={e => setAddDeliveryTime(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                            </div>
                             <div className="space-y-2 col-span-1 md:col-span-2">
                                <Label>Endereço</Label>
                                <Input value={addAddress} onChange={e => setAddAddress(e.target.value)} className="bg-zinc-800 border-zinc-700" placeholder="Endereço de entrega"/>
                            </div>
                             <div className="space-y-2">
                                <Label>Taxa de Entrega (R$)</Label>
                                <Input type="number" value={addDeliveryFee} onChange={e => setAddDeliveryFee(e.target.value)} className="bg-zinc-800 border-zinc-700" placeholder="0.00"/>
                            </div>
                            <div className="space-y-2">
                                <Label>Forma de Pagamento</Label>
                                <Select value={addPaymentMethod} onValueChange={setAddPaymentMethod}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue placeholder="Selecione o pagamento"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PIX">PIX</SelectItem>
                                        <SelectItem value="Crédito">Crédito</SelectItem>
                                        <SelectItem value="Débito">Débito</SelectItem>
                                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <Separator className="bg-zinc-700" />

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Itens do Pedido</h3>
                            <div className="flex flex-wrap items-stretch gap-2">
                                <Select value={addSelectedProductId} onValueChange={setAddSelectedProductId}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700 flex-1 min-w-[200px] h-10">
                                        <SelectValue placeholder="Selecione um produto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products.map(p => (
                                            <SelectItem key={p.id} value={p.id} disabled={p.quantity <= 0}>
                                                {p.name} - {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({p.quantity} em estoque)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1">
                                    <Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800 cursor-pointer" onClick={() => setAddItemQuantity(prev => Math.max(1, prev - 1))}>
                                        <Minus className="h-4 w-4"/>
                                    </Button>
                                    <Input type="number" value={addItemQuantity} onChange={(e) => setAddItemQuantity(parseInt(e.target.value) || 1)} className="w-16 h-10 text-center bg-zinc-800 border-zinc-700"/>
                                    <Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800 cursor-pointer" onClick={() => setAddItemQuantity(prev => prev + 1)}>
                                        <Plus className="h-4 w-4"/>
                                    </Button>
                                </div>
                                <Button onClick={() => handleAddItemToList(addOrderItems, setAddOrderItems, addSelectedProductId, addItemQuantity, setAddSelectedProductId, setAddItemQuantity, setAddFormError)} className="h-10 bg-zinc-700 hover:bg-zinc-600 text-white cursor-pointer">Adicionar</Button>
                            </div>

                            <div className="flex-grow space-y-2 mt-4">
                                {addOrderItems.map(item => (
                                    <div key={item.product_id} className="flex justify-between items-center text-sm p-2 bg-zinc-800 rounded">
                                        <div>
                                            <p>{item.quantity}x {item.product_name}</p>
                                            <p className="text-xs text-zinc-400">{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                        <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-900/20 cursor-pointer" onClick={() => handleRemoveItemFromList(addOrderItems, setAddOrderItems, item.product_id)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Observações (opcional)</Label>
                            <Textarea value={addNotes} onChange={(e) => setAddNotes(e.target.value)} className="bg-zinc-800 border-zinc-700" placeholder="Detalhes sobre o pedido..."/>
                        </div>

                        <div className="pt-4 border-t border-zinc-700 text-right">
                            <Label>Valor Total</Label>
                            <p className="text-2xl font-bold">{calculateTotal(addOrderItems, addDeliveryFee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                    {addFormError && <p className="text-sm text-red-500 mt-2">{addFormError}</p>}
                    <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                       <Button variant="outline" className="bg-transparent border-zinc-700 hover:bg-zinc-800 hover:text-white cursor-pointer" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                       <Button className="bg-white text-black hover:bg-gray-300 cursor-pointer" onClick={handleCreateOrder} disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : "Salvar Pedido"}
                       </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Editar Pedido: {editingOrder?.order_code}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-1 md:col-span-2">
                                <Label>Cliente</Label>
                                <Select value={editCustomerId} onValueChange={setEditCustomerId}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                                    <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone || 'Sem telefone'})</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Data de Entrega</Label>
                                <Input type="date" value={editOrderDate} onChange={e => setEditOrderDate(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                            </div>
                             <div className="space-y-2">
                                <Label>Hora da Entrega</Label>
                                <Input type="time" value={editDeliveryTime} onChange={e => setEditDeliveryTime(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                            </div>
                            <div className="space-y-2 col-span-1 md:col-span-2">
                                <Label>Endereço</Label>
                                <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                            </div>
                            <div className="space-y-2">
                                <Label>Taxa de Entrega (R$)</Label>
                                <Input type="number" value={editDeliveryFee} onChange={e => setEditDeliveryFee(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                            </div>
                            <div className="space-y-2">
                                <Label>Forma de Pagamento</Label>
                                <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PIX">PIX</SelectItem>
                                        <SelectItem value="Crédito">Crédito</SelectItem>
                                        <SelectItem value="Débito">Débito</SelectItem>
                                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Separator className="bg-zinc-700" />
                        
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Itens do Pedido</h3>
                            <div className="flex flex-wrap items-stretch gap-2">
                                <Select value={editSelectedProductId} onValueChange={setEditSelectedProductId}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700 flex-1 min-w-[200px] h-10">
                                        <SelectValue placeholder="Selecione um produto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products.map(p => (
                                            <SelectItem key={p.id} value={p.id} disabled={p.quantity <= 0}>
                                                {p.name} - {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({p.quantity} em estoque)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1">
                                    <Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800 cursor-pointer" onClick={() => setEditItemQuantity(prev => Math.max(1, prev - 1))}>
                                        <Minus className="h-4 w-4"/>
                                    </Button>
                                    <Input type="number" value={editItemQuantity} onChange={(e) => setEditItemQuantity(parseInt(e.target.value) || 1)} className="w-16 h-10 text-center bg-zinc-800 border-zinc-700"/>
                                    <Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800 cursor-pointer" onClick={() => setEditItemQuantity(prev => prev + 1)}>
                                        <Plus className="h-4 w-4"/>
                                    </Button>
                                </div>
                                <Button onClick={() => handleAddItemToList(editOrderItems, setEditOrderItems, editSelectedProductId, editItemQuantity, setEditSelectedProductId, setEditItemQuantity, setEditFormError)} className="h-10 bg-zinc-700 hover:bg-zinc-600 text-white cursor-pointer">Adicionar</Button>
                            </div>

                            <div className="flex-grow space-y-2 mt-4">
                                {editOrderItems.map(item => (
                                    <div key={item.product_id} className="flex justify-between items-center text-sm p-2 bg-zinc-800 rounded">
                                        <div>
                                            <p>{item.quantity}x {item.product_name}</p>
                                            <p className="text-xs text-zinc-400">{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                        <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-900/20 cursor-pointer" onClick={() => handleRemoveItemFromList(editOrderItems, setEditOrderItems, item.product_id)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                         <div className="space-y-2">
                            <Label>Observações (opcional)</Label>
                            <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="bg-zinc-800 border-zinc-700" placeholder="Detalhes sobre o pedido..."/>
                        </div>

                        <div className="pt-4 border-t border-zinc-700 text-right">
                            <Label>Valor Total</Label>
                            <p className="text-2xl font-bold">{calculateTotal(editOrderItems, editDeliveryFee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                    {editFormError && <p className="text-sm text-red-500 mt-2">{editFormError}</p>}
                    <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-between w-full">
                        <Button variant="ghost" className="text-red-500 hover:bg-red-900/20 hover:text-red-400 cursor-pointer" onClick={() => handleDeleteOrder(editingOrder!.id)} disabled={loading}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Pedido
                        </Button>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                           <Button variant="outline" className="bg-transparent border-zinc-700 hover:bg-zinc-800 hover:text-white cursor-pointer" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                           <Button className="bg-white text-black hover:bg-gray-300 cursor-pointer" onClick={handleUpdateOrder} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}
                           </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-lg bg-[#1C1C1C] text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Pedido: {selectedOrderDetails?.order_code}</DialogTitle>
                         <p className="text-sm text-zinc-400">Informações completas sobre o pedido.</p>
                    </DialogHeader>
                    {selectedOrderDetails && (
                        <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <p><strong>Cliente:</strong></p>
                                <p>{selectedOrderDetails.customer_name}</p>

                                <p><strong>Telefone:</strong></p>
                                <p>{selectedOrderDetails.customer_phone || 'N/A'}</p>

                                <p><strong>Endereço de Entrega:</strong></p>
                                <p>{selectedOrderDetails.address || 'Não informado'}</p>
                            </div>
                            
                            <div>
                                <p className="font-bold mb-2">Itens do Pedido:</p>
                                <div className="space-y-1 text-sm">
                                {selectedOrderDetails.items.map(item => (
                                    <div key={item.product_id} className="flex justify-between items-center">
                                        <span>{item.quantity}x {item.product_name}</span>
                                        <span className="text-zinc-400">{item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                ))}
                                </div>
                            </div>
                            
                            <div className="space-y-2 pt-4 border-t border-zinc-700">
                                <div className="flex justify-between">
                                     <p><strong>Taxa de Entrega:</strong></p>
                                     <p>{selectedOrderDetails.delivery_fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                                <div className="flex justify-between font-bold text-lg">
                                     <p>Total do Pedido:</p>
                                     <p>{selectedOrderDetails.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                            </div>
                            
                             <div className="space-y-2 pt-4 border-t border-zinc-700">
                                <div className="flex justify-between">
                                    <p><strong>Data de Entrega:</strong></p>
                                    <p>{new Date(selectedOrderDetails.order_date + 'T' + selectedOrderDetails.delivery_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {selectedOrderDetails.delivery_time}</p>
                                </div>
                                 <div className="flex justify-between">
                                    <p><strong>Pagamento:</strong></p>
                                    <p>{selectedOrderDetails.payment_method}</p>
                                </div>
                                <div className="flex flex-col text-left">
                                     <p><strong>Observações:</strong></p>
                                     <p className="text-zinc-400">{selectedOrderDetails.notes || 'Nenhuma observação'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="sm:justify-end">
                        <Button 
                            className="bg-white text-black hover:bg-gray-300 w-full sm:w-auto" 
                            onClick={() => setIsDetailsDialogOpen(false)}
                        >
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}