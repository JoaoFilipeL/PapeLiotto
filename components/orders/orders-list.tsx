"use client"
import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Loader2, Edit, Trash2, Archive, Eye, Minus } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Label } from "@/components/ui/label"

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
    address: string;
    order_date: string;
    payment_method: string;
    total_amount: number;
    items: OrderItem[];
}

export function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [addFormError, setAddFormError] = useState<string | null>(null);
    const [nextOrderCode, setNextOrderCode] = useState("");
    const [addSelectedCustomerId, setAddSelectedCustomerId] = useState<string>("");
    const [addAddress, setAddAddress] = useState("");
    const [addOrderDate, setAddOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [addPaymentMethod, setAddPaymentMethod] = useState<string>("");
    const [addOrderItems, setAddOrderItems] = useState<OrderItem[]>([]);
    const [addProductSearch, setAddProductSearch] = useState("");

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [editCustomerId, setEditCustomerId] = useState<string>("");
    const [editAddress, setEditAddress] = useState("");
    const [editOrderDate, setEditOrderDate] = useState("");
    const [editPaymentMethod, setEditPaymentMethod] = useState("");
    const [editOrderItems, setEditOrderItems] = useState<OrderItem[]>([]);
    const [editProductSearch, setEditProductSearch] = useState("");
    const [editFormError, setEditFormError] = useState<string | null>(null);

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
            setProducts(productsData.map(p => ({ ...p, price: parseFloat(p.price) })));

            const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
            if (ordersError) throw ordersError;

            const orderIds = ordersData.map(o => o.id);
            const { data: itemsData, error: itemsError } = await supabase.from('order_items').select('*').in('order_id', orderIds);
            if (itemsError) throw itemsError;

            const combinedOrders: Order[] = ordersData.map(order => ({
                ...order,
                total_amount: parseFloat(order.total_amount),
                items: itemsData.filter(item => item.order_id === order.id).map(item => ({...item, unit_price: parseFloat(item.unit_price)}))
            }));
            
            setOrders(combinedOrders);

            const lastId = ordersData.length > 0 ? Math.max(...ordersData.map(o => parseInt(o.order_code.split('-')[1]))) : 0;
            setNextOrderCode(`PED-${(lastId + 1).toString().padStart(4, '0')}`);
        } catch (err: any) {
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

    const calculateTotal = (items: OrderItem[]) => items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);

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
            const total_amount = calculateTotal(addOrderItems);
            const { data: orderData, error: orderError } = await supabase
                .from('orders').insert({
                    order_code: nextOrderCode,
                    customer_id: addSelectedCustomerId,
                    customer_name: customer.name,
                    address: addAddress,
                    order_date: addOrderDate,
                    payment_method: addPaymentMethod,
                    total_amount: total_amount,
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
        } catch (err: any) {
            setAddFormError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateOrder = async () => {
        if (!editingOrder || !editCustomerId || editOrderItems.length === 0 || !editPaymentMethod) {
            setEditFormError("Todos os campos devem ser preenchidos.");
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

            const total_amount = calculateTotal(editOrderItems);
            const { error: orderUpdateError } = await supabase.from('orders').update({
                customer_id: editCustomerId,
                customer_name: customer.name,
                address: editAddress,
                order_date: editOrderDate,
                payment_method: editPaymentMethod,
                total_amount
            }).eq('id', editingOrder.id);
            if(orderUpdateError) throw orderUpdateError;

            await supabase.from('order_items').delete().eq('order_id', editingOrder.id);
            const itemsToInsert = editOrderItems.map(item => ({ order_id: editingOrder.id, ...item }));
            await supabase.from('order_items').insert(itemsToInsert);
            
            setIsEditDialogOpen(false);
        } catch (err: any) {
            setEditFormError(err.message);
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
        } catch (err: any) {
            setEditFormError(err.message);
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
        setEditAddress(order.address);
        setEditOrderDate(order.order_date);
        setEditPaymentMethod(order.payment_method);
        setEditOrderItems(order.items);
        setEditFormError(null);
        setEditProductSearch("");
        setIsEditDialogOpen(true);
    };
    
    const handleEditProductAction = (product: Product) => {
        const existingItem = editOrderItems.find(item => item.product_id === product.id);
        if (existingItem) {
            if (existingItem.quantity < product.quantity) {
                setEditOrderItems(editOrderItems.map(item =>
                    item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                ));
            }
        } else {
            if (product.quantity > 0) {
                setEditOrderItems([...editOrderItems, {
                    product_id: product.id,
                    product_name: product.name,
                    quantity: 1,
                    unit_price: product.price
                }]);
            }
        }
    };

    const handleEditItemQuantityChange = (productId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            setEditOrderItems(editOrderItems.filter(item => item.product_id !== productId));
        } else {
             const product = products.find(p => p.id === productId);
             if (product && newQuantity > product.quantity) {
                 setEditFormError(`Estoque máximo (${product.quantity}) atingido.`);
                 return;
             }
            setEditOrderItems(editOrderItems.map(item =>
                item.product_id === productId ? { ...item, quantity: newQuantity } : item
            ));
        }
    };

    const filteredOrders = orders.filter(o =>
        o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.order_code.toLowerCase().includes(searchTerm.toLowerCase())
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
                    <Button className="w-full sm:w-auto bg-white text-black hover:bg-gray-200 rounded-lg font-semibold py-2 px-4 flex items-center gap-2" onClick={() => setIsAddDialogOpen(true)}>
                        <Archive className="h-5 w-5" />
                        Adicionar Pedido
                    </Button>
                </div>
            </div>

            {loading && <div className="text-center text-white py-8"><Loader2 className="h-10 w-10 animate-spin text-white mx-auto" /><p className="mt-3">Carregando...</p></div>}
            {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md">{error}</div>}

            {!loading && !error && filteredOrders.length > 0 && (
                <div className="flex items-center px-3 pb-2 mb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="flex-1 text-left pr-4">Pedido</div>
                    <div className="flex-1 text-left pr-4">Cliente</div>
                    <div className="flex-1 text-left pr-4">Endereço</div>
                    <div className="flex-1 text-left pr-4">Data</div>
                    <div className="flex-1 text-left pr-4">Itens</div>
                    <div className="flex-1 text-left pr-4">Pagamento</div>
                    <div className="flex-1 text-right pr-4">Total</div>
                    <div className="w-12"></div>
                </div>
            )}
            
            <div className="space-y-2">
                {!loading && filteredOrders.map(order => (
                    <div key={order.id} className="flex items-center bg-[#1C1C1C] p-3 rounded-lg hover:bg-zinc-800 transition-colors duration-200 cursor-pointer" onClick={() => openEditDialog(order)}>
                        <div className="flex-1 text-left pr-4 text-white font-medium truncate">{order.order_code}</div>
                        <div className="flex-1 text-left pr-4 text-zinc-400 truncate">{order.customer_name}</div>
                        <div className="flex-1 text-left pr-4 text-zinc-400 truncate">{order.address}</div>
                        <div className="flex-1 text-left pr-4 text-zinc-400 truncate">{new Date(order.order_date + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                        <div className="flex-1 text-left pr-4 text-zinc-400 truncate">{order.items.reduce((acc, item) => acc + item.quantity, 0)}</div>
                        <div className="flex-1 text-left pr-4 text-zinc-400 truncate">{order.payment_method}</div>
                        <div className="flex-1 text-right pr-4 text-white font-semibold truncate">{order.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div className="w-12 text-center">
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDetailsDialog(order); }}>
                                <Eye className="h-5 w-5 text-zinc-400" />
                            </Button>
                        </div>
                    </div>
                ))}
                {!loading && filteredOrders.length === 0 && !error && (
                    <div className="text-center text-zinc-500 py-10">Nenhum pedido encontrado.</div>
                )}
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                 {/* Modal de Adicionar Pedido aqui */}
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-4xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Editar Pedido: {editingOrder?.order_code}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-6 py-4 max-h-[70vh]">
                        <div className="space-y-4 pr-4 border-r border-zinc-700">
                            <div className="space-y-2">
                                <Label>Cliente</Label>
                                <Select value={editCustomerId} onValueChange={setEditCustomerId}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                                    <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Endereço</Label>
                                <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                            </div>
                            <div className="space-y-2">
                                <Label>Data</Label>
                                <Input type="date" value={editOrderDate} onChange={e => setEditOrderDate(e.target.value)} className="bg-zinc-800 border-zinc-700" />
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
                            <div className="pt-4 border-t border-zinc-700 text-right">
                                <Label>Valor Total</Label>
                                <p className="text-2xl font-bold">{calculateTotal(editOrderItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <Input placeholder="Buscar Produtos..." value={editProductSearch} onChange={e => setEditProductSearch(e.target.value)} className="bg-zinc-800 border-zinc-700 mb-4" />
                            <div className="flex-grow space-y-2 overflow-y-auto">
                                {editOrderItems.map(item => (
                                    <div key={item.product_id} className="flex justify-between items-center text-sm p-2 bg-zinc-800 rounded">
                                        <div>
                                            <p>{item.product_name}</p>
                                            <p className="text-xs text-zinc-400">{(item.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" onClick={() => handleEditItemQuantityChange(item.product_id, item.quantity - 1)}><Minus className="h-4 w-4"/></Button>
                                            <Input type="number" value={item.quantity} onChange={(e) => handleEditItemQuantityChange(item.product_id, parseInt(e.target.value) || 1)} className="w-12 h-8 text-center bg-zinc-700"/>
                                            <Button size="icon" variant="ghost" onClick={() => handleEditItemQuantityChange(item.product_id, item.quantity + 1)}><Plus className="h-4 w-4"/></Button>
                                        </div>
                                    </div>
                                ))}
                                {editProductSearch && products.filter(p=>p.name.toLowerCase().includes(editProductSearch.toLowerCase())).map(p => (
                                    <div key={p.id} className="flex justify-between items-center p-2 rounded cursor-pointer hover:bg-zinc-800" onClick={() => handleEditProductAction(p)}>
                                        <span>{p.name} ({p.quantity})</span>
                                        <Plus className="h-4 w-4 text-zinc-400"/>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {editFormError && <p className="text-sm text-red-500">{editFormError}</p>}
                    <DialogFooter className="mt-4 flex justify-between w-full">
                        <Button variant="ghost" className="text-red-500 hover:bg-red-900/20 hover:text-red-400" onClick={() => handleDeleteOrder(editingOrder!.id)} disabled={loading}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Pedido
                        </Button>
                        <div className="flex gap-2">
                           <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                           <Button onClick={handleUpdateOrder} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}
                           </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-lg bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Pedido: {selectedOrderDetails?.order_code}</DialogTitle>
                    </DialogHeader>
                    {selectedOrderDetails && (
                        <div className="py-4 space-y-4">
                            <p><strong>Cliente:</strong> {selectedOrderDetails.customer_name}</p>
                            <p><strong>Endereço:</strong> {selectedOrderDetails.address}</p>
                            <p><strong>Data:</strong> {new Date(selectedOrderDetails.order_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                            <p><strong>Pagamento:</strong> {selectedOrderDetails.payment_method}</p>
                            <div>
                                <strong>Itens:</strong>
                                <div className="mt-2 space-y-1">
                                {selectedOrderDetails.items.map(item => (
                                    <div key={item.product_id} className="flex justify-between text-sm">
                                        <span>{item.quantity}x {item.product_name}</span>
                                        <span>{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                ))}
                                </div>
                            </div>
                             <div className="pt-4 border-t border-zinc-700 text-right font-bold text-lg">
                                Total: {selectedOrderDetails.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                             </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
