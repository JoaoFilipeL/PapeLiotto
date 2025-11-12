'use client'
import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Trash2, Eye } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Order, OrderItem, Customer, Budget, CurrentUser } from "./types/orders"
import { Product } from "../stock/types/stock"
import { toast } from "sonner"

const calculateTotal = (items: OrderItem[], fee: string) => {
    const itemsTotal = items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
    return itemsTotal + (parseFloat(fee) || 0);
};

const handleAddItemToList = (
    list: OrderItem[], 
    setList: React.Dispatch<React.SetStateAction<OrderItem[]>>, 
    productId: string, 
    quantity: number, 
    products: Product[],
    setProductId: (id: string) => void, 
    setQuantity: (q: number) => void, 
    setErrorFunc: (e: string | null) => void,
    setProductSearch: (s: string) => void
) => {
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
        setList(list.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + quantity } : item));
    } else { 
        setList([...list, { product_id: product.id, product_name: product.name, quantity: quantity, unit_price: product.price }]); 
    }
    setProductId(""); 
    setQuantity(1); 
    setProductSearch("");
};

const handleRemoveItemFromList = (
    list: OrderItem[], 
    setList: React.Dispatch<React.SetStateAction<OrderItem[]>>, 
    productId: string
) => { 
    setList(list.filter(item => item.product_id !== productId)); 
};

interface AddOrderDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    nextOrderCode: string;
    customers: Customer[];
    products: Product[];
    availableBudgets: Budget[];
    currentUser: CurrentUser | null;
    onOrderCreated: () => void;
}

export function AddOrderDialog({ isOpen, onOpenChange, nextOrderCode, customers, products, availableBudgets, currentUser, onOrderCreated }: AddOrderDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
    const [address, setAddress] = useState("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const [orderDate, setOrderDate] = useState(todayString);
    const [paymentMethod, setPaymentMethod] = useState<string>("");
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [itemQuantity, setItemQuantity] = useState(1);
    const [notes, setNotes] = useState("");
    const [deliveryTime, setDeliveryTime] = useState("12:00");
    const [deliveryFee, setDeliveryFee] = useState("0");
    const [minTime, setMinTime] = useState("00:00");
    const [importBudgetId, setImportBudgetId] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState("");
    const supabase = createClientComponentClient();

    useEffect(() => {
        if (orderDate === todayString) {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5);
            setMinTime(currentTime);
            if (deliveryTime < currentTime) setDeliveryTime(currentTime);
        } else {
            setMinTime("00:00");
        }
    }, [orderDate, todayString, deliveryTime]);

    useEffect(() => {
        if (selectedCustomerId) {
            const customer = customers.find(c => c.id === selectedCustomerId);
            if (customer) { setAddress(customer.address || ""); }
        } else {
            setAddress("");
        }
    }, [selectedCustomerId, customers]);

    useEffect(() => {
        if (importBudgetId) {
            const selectedBudget = availableBudgets.find(b => b.id.toString() === importBudgetId);
            if (selectedBudget) {
                if (selectedBudget.customer_id) {
                    setSelectedCustomerId(selectedBudget.customer_id);
                }
                setOrderItems(selectedBudget.items);
            }
        }
    }, [importBudgetId, availableBudgets]);

    const resetAddForm = () => {
        setSelectedCustomerId(""); setAddress(""); setOrderDate(todayString); setPaymentMethod(""); setOrderItems([]); setSelectedProductId(""); setItemQuantity(1); setNotes(""); setDeliveryTime("12:00"); setDeliveryFee("0"); setFormError(null);
        setImportBudgetId(null);
        setProductSearch("");
    };
    
    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            resetAddForm();
        }
        onOpenChange(open);
    };

    const handleCreateOrder = async () => {
        if (!selectedCustomerId || orderItems.length === 0 || !paymentMethod) { setFormError("Preencha: Cliente, Forma de Pagamento e adicione ao menos um item."); return; }
        setLoading(true); setFormError(null);
        try {
            for (const item of orderItems) {
                const productInStock = products.find(p => p.id === item.product_id);
                if (!productInStock || productInStock.quantity < item.quantity) {
                    throw new Error(`Estoque insuficiente para "${item.product_name}". Apenas ${productInStock?.quantity || 0} disponíveis.`);
                }
            }
            
            const customer = customers.find(c => c.id === selectedCustomerId);
            if (!customer) throw new Error("Cliente não encontrado.");
            const total_amount = calculateTotal(orderItems, deliveryFee);
            const { data: orderData, error: orderError } = await supabase.from('orders').insert({ order_code: nextOrderCode, customer_id: selectedCustomerId, customer_name: customer.name, address: address, order_date: orderDate, payment_method: paymentMethod, total_amount: total_amount, notes: notes, delivery_time: deliveryTime, delivery_fee: parseFloat(deliveryFee) || 0, status: 'Pendente', employee_name: currentUser?.email }).select().single();
            if (orderError) throw orderError;
            
            const itemsToInsert = orderItems.map(item => ({ order_id: orderData.id, ...item }));
            const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            toast.success(`Pedido ${nextOrderCode} criado com sucesso!`);
            handleModalOpenChange(false);
            onOrderCreated();
        } catch (err) {
            if (err instanceof Error) setFormError(err.message);
            else setFormError("Ocorreu um erro desconhecido.");
            toast.error("Erro ao criar pedido.");
        } finally {
            setLoading(false);
        }
    };
    
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

    return (
        <Dialog open={isOpen} onOpenChange={handleModalOpenChange}>
            <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                <DialogHeader><DialogTitle>Adicionar Novo Pedido: {nextOrderCode}</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label>Importar de Orçamento (Opcional)</Label>
                            <Select value={importBudgetId || ""} onValueChange={setImportBudgetId}>
                                <SelectTrigger className="bg-zinc-800 border-zinc-700 cursor-pointer"><SelectValue placeholder="Selecione um orçamento para importar..." /></SelectTrigger>
                                <SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer">
                                    {availableBudgets.map(b => <SelectItem key={b.id} value={b.id.toString()} className="cursor-pointer">{b.budget_code} - {b.customer_name || 'Sem cliente'}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 col-span-2"><Label>Cliente</Label><Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}><SelectTrigger className="bg-zinc-800 border-zinc-700 cursor-pointer"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer">{customers.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label>Data de Entrega</Label><Input type="date" value={orderDate} min={todayString} onChange={e => setOrderDate(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                        <div className="space-y-2"><Label>Hora da Entrega</Label><Input type="time" value={deliveryTime} min={minTime} onChange={e => setDeliveryTime(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                        <div className="space-y-2 col-span-2"><Label>Endereço</Label><Input value={address} onChange={e => setAddress(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                        <div className="space-y-2"><Label>Taxa de Entrega (R$)</Label><Input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                        <div className="space-y-2"><Label>Pagamento</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger className="bg-zinc-800 border-zinc-700 cursor-pointer"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer"><SelectItem className="cursor-pointer" value="PIX">PIX</SelectItem><SelectItem className="cursor-pointer" value="Crédito">Crédito</SelectItem><SelectItem className="cursor-pointer" value="Débito">Débito</SelectItem><SelectItem className="cursor-pointer" value="Dinheiro">Dinheiro</SelectItem></SelectContent></Select></div>
                    </div>
                    <Separator className="bg-zinc-700" />
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Itens do Pedido</h3>
                        <div className="flex flex-wrap items-stretch gap-2">
                            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                <SelectTrigger className="bg-zinc-800 border-zinc-700 flex-1 min-w-[200px] h-10 cursor-pointer"><SelectValue placeholder="Selecione um produto..." /></SelectTrigger>
                                <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                                    <div className="p-2 sticky top-0 bg-zinc-800 z-10">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                            <Input type="search" placeholder="Buscar produto..." className="w-full bg-zinc-700 border-zinc-600 placeholder:text-zinc-400 pl-10" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}/>
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {filteredProducts.length > 0 ? filteredProducts.map(p => (<SelectItem key={p.id} value={p.id} disabled={p.quantity <= 0} className="cursor-pointer">{p.name} ({p.quantity} disp.)</SelectItem>)) : <p className="text-sm text-center text-zinc-400 py-2">Nenhum produto encontrado.</p>}
                                    </div>
                                </SelectContent>
                            </Select>
                            <Input type="number" value={itemQuantity} onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)} className="w-20 h-10 text-center bg-zinc-800 border-zinc-700" />
                            <Button onClick={() => handleAddItemToList(orderItems, setOrderItems, selectedProductId, itemQuantity, products, setSelectedProductId, setItemQuantity, setFormError, setProductSearch)} className="h-10 bg-zinc-700 hover:bg-zinc-600 cursor-pointer">Adicionar</Button>
                        </div>
                        <div className="flex-grow space-y-2 mt-4">{orderItems.map(item => (<div key={item.product_id} className="flex justify-between items-center text-sm p-2 bg-zinc-800 rounded"><div><p>{item.quantity}x {item.product_name}</p></div><Button size="icon" variant="ghost" className="text-red-500 cursor-pointer" onClick={() => handleRemoveItemFromList(orderItems, setOrderItems, item.product_id)}><Trash2 /></Button></div>))}</div>
                    </div>
                    <div className="space-y-2"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                    <div className="pt-4 border-t border-zinc-700 text-right"><Label>Valor Total</Label><p className="text-2xl font-bold">{calculateTotal(orderItems, deliveryFee).toLocaleString('pt-BR', { style: 'currency', 'currency': 'BRL' })}</p></div>
                </div>
                {formError && <p className="text-sm text-red-500 mt-2">{formError}</p>}
                <DialogFooter className="mt-4">
                    <Button variant="ghost" onClick={() => handleModalOpenChange(false)} className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">Cancelar</Button>
                    <Button variant="ghost" onClick={handleCreateOrder} disabled={loading} className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">{loading ? <Loader2 className="animate-spin" /> : "Salvar Pedido"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface EditOrderDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editingOrder: Order | null;
    customers: Customer[];
    products: Product[];
    onOrderUpdated: () => void;
    onOrderDeleted: () => void;
}

export function EditOrderDialog({ isOpen, onOpenChange, editingOrder, customers, products, onOrderUpdated, onOrderDeleted }: EditOrderDialogProps) {
    const [loading, setLoading] = useState(false);
    const [customerId, setCustomerId] = useState<string>("");
    const [address, setAddress] = useState("");
    const [orderDate, setOrderDate] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [itemQuantity, setItemQuantity] = useState(1);
    const [notes, setNotes] = useState("");
    const [deliveryTime, setDeliveryTime] = useState("12:00");
    const [deliveryFee, setDeliveryFee] = useState("0");
    const [formError, setFormError] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState("");
    const supabase = createClientComponentClient();

    useEffect(() => {
        if (editingOrder) {
            setCustomerId(editingOrder.customer_id);
            setAddress(editingOrder.address || "");
            setOrderDate(editingOrder.order_date);
            setPaymentMethod(editingOrder.payment_method);
            setOrderItems(editingOrder.items);
            setNotes(editingOrder.notes || "");
            setDeliveryTime(editingOrder.delivery_time || "12:00");
            setDeliveryFee(editingOrder.delivery_fee?.toString() || "0");
            setFormError(null);
            setProductSearch("");
        }
    }, [editingOrder]);

    const handleUpdateOrder = async () => {
        if (!editingOrder || !customerId || orderItems.length === 0) { setFormError("Cliente e itens são obrigatórios."); return; }
        setLoading(true); setFormError(null);
        try {
            const customer = customers.find(c => c.id === customerId);
            if (!customer) throw new Error("Cliente não encontrado.");
            
            const total_amount = calculateTotal(orderItems, deliveryFee);
            const { error: orderUpdateError } = await supabase.from('orders').update({ customer_id: customerId, customer_name: customer.name, address: address, order_date: orderDate, payment_method: paymentMethod, total_amount, notes: notes, delivery_time: deliveryTime, delivery_fee: parseFloat(deliveryFee) || 0 }).eq('id', editingOrder.id);
            if (orderUpdateError) throw orderUpdateError;
            
            await supabase.from('order_items').delete().eq('order_id', editingOrder.id);
            
            const itemsToInsert = orderItems.map(item => ({ order_id: editingOrder.id, product_id: item.product_id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price }));
            await supabase.from('order_items').insert(itemsToInsert);
            
            toast.success("Pedido atualizado com sucesso!");
            onOpenChange(false);
            onOrderUpdated();
        } catch (err) {
            if (err instanceof Error) setFormError(err.message);
            else setFormError("Ocorreu um erro desconhecido.");
            toast.error("Erro ao atualizar pedido.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOrder = async () => {
        if (!editingOrder) return;
        if (!window.confirm("Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita e o estoque NÃO será revertido.")) return;
        setLoading(true);
        try {
            await supabase.from('order_items').delete().eq('order_id', editingOrder.id);
            await supabase.from('orders').delete().eq('id', editingOrder.id);
            
            toast.success("Pedido excluído permanentemente!");
            onOpenChange(false);
            onOrderDeleted();
        } catch (err) {
            if (err instanceof Error) setFormError(err.message);
            else setFormError("Ocorreu um erro desconhecido ao excluir.");
            toast.error("Erro ao excluir pedido.");
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                <DialogHeader><DialogTitle>Editar Pedido: {editingOrder?.order_code}</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2"><Label>Cliente</Label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger className="bg-zinc-800 border-zinc-700 cursor-pointer"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer">{customers.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label>Data de Entrega</Label><Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                        <div className="space-y-2"><Label>Hora da Entrega</Label><Input type="time" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                        <div className="space-y-2 col-span-2"><Label>Endereço</Label><Input value={address} onChange={e => setAddress(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                        <div className="space-y-2"><Label>Taxa de Entrega (R$)</Label><Input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                        <div className="space-y-2"><Label>Pagamento</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger className="bg-zinc-800 border-zinc-700 cursor-pointer"><SelectValue /></SelectTrigger><SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer"><SelectItem className="cursor-pointer" value="PIX">PIX</SelectItem><SelectItem className="cursor-pointer" value="Crédito">Crédito</SelectItem><SelectItem className="cursor-pointer" value="Débito">Débito</SelectItem><SelectItem className="cursor-pointer" value="Dinheiro">Dinheiro</SelectItem></SelectContent></Select></div>
                    </div>
                    <Separator className="bg-zinc-700" />
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Itens do Pedido</h3>
                        <div className="flex flex-wrap items-stretch gap-2">
                           <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                <SelectTrigger className="bg-zinc-800 border-zinc-700 flex-1 min-w-[200px] h-10 cursor-pointer"><SelectValue placeholder="Selecione um produto..." /></SelectTrigger>
                                <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                                    <div className="p-2 sticky top-0 bg-zinc-800 z-10">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                            <Input type="search" placeholder="Buscar produto..." className="w-full bg-zinc-700 border-zinc-600 placeholder:text-zinc-400 pl-10" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}/>
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {filteredProducts.length > 0 ? filteredProducts.map(p => (<SelectItem key={p.id} value={p.id} disabled={p.quantity <= 0} className="cursor-pointer">{p.name} ({p.quantity} disp.)</SelectItem>)) : <p className="text-sm text-center text-zinc-400 py-2">Nenhum produto encontrado.</p>}
                                    </div>
                                </SelectContent>
                            </Select>
                            <Input type="number" value={itemQuantity} onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)} className="w-20 h-10 text-center bg-zinc-800 border-zinc-700" />
                            <Button onClick={() => handleAddItemToList(orderItems, setOrderItems, selectedProductId, itemQuantity, products, setSelectedProductId, setItemQuantity, setFormError, setProductSearch)} className="h-10 bg-zinc-700 hover:bg-zinc-600 cursor-pointer">Adicionar</Button>
                        </div>
                        <div className="flex-grow space-y-2 mt-4">{orderItems.map(item => (<div key={item.product_id} className="flex justify-between items-center text-sm p-2 bg-zinc-800 rounded"><div><p>{item.quantity}x {item.product_name}</p></div><Button size="icon" variant="ghost" className="text-red-500 cursor-pointer" onClick={() => handleRemoveItemFromList(orderItems, setOrderItems, item.product_id)}><Trash2 /></Button></div>))}</div>
                    </div>
                    <div className="space-y-2"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                    <div className="pt-4 border-t border-zinc-700 text-right"><Label>Valor Total</Label><p className="text-2xl font-bold">{calculateTotal(orderItems, deliveryFee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                </div>
                {formError && <p className="text-sm text-red-500 mt-2">{formError}</p>}
                <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-between w-full">
                    <Button variant="ghost" className="text-red-500 hover:bg-red-900/20 hover:text-red-400 justify-start sm:justify-center cursor-pointer" onClick={handleDeleteOrder} disabled={loading}><Trash2 className="mr-2 h-4 w-4" />Excluir Pedido</Button>
                    <div>
                        <Button variant="ghost" className="mr-2 cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={() => onOpenChange(false)} >Cancelar</Button>
                        <Button variant="ghost" className="mr-2 cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={handleUpdateOrder} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface OrderDetailsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    order: Order | null;
}

export function OrderDetailsDialog({ isOpen, onOpenChange, order }: OrderDetailsDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg bg-zinc-900 text-white border-zinc-700">
                <DialogHeader><DialogTitle>Detalhes do Pedido: {order?.order_code}</DialogTitle></DialogHeader>
                {order && (
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <strong className="text-zinc-400">Cliente:</strong> <span>{order.customer_name}</span>
                            <strong className="text-zinc-400">Telefone:</strong> <span>{order.customer_phone || 'N/A'}</span>
                            <strong className="text-zinc-400 col-span-2">Endereço:</strong> <span className="col-span-2">{order.address}</span>
                            <strong className="text-zinc-400">Data Entrega:</strong> <span>{new Date(order.order_date + 'T00:00:00').toLocaleDateString('pt-BR')} às {order.delivery_time}</span>
                            <strong className="text-zinc-400">Pagamento:</strong> <span>{order.payment_method}</span>
                            <strong className="text-zinc-400">Atendente:</strong> <span>{order.employee_name || 'N/A'}</span>
                            <strong className="text-zinc-400">Pedido Criado Em:</strong> <span>{new Date(order.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                        <Separator className="bg-zinc-700" />
                        <div><strong>Itens:</strong><div className="mt-2 space-y-1">{order.items.map(item => (<div key={item.product_id} className="flex justify-between text-sm"><span>{item.quantity}x {item.product_name}</span><span>{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>))}</div></div>
                        {order.delivery_fee > 0 && (<div className="flex justify-between text-sm pt-2 border-t border-zinc-700"><strong>Taxa de Entrega:</strong><span>{order.delivery_fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>)}
                        <div className="pt-2 border-t border-zinc-700 text-right font-bold text-lg">Total: {order.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        {order.notes && (<div className="pt-2 border-t border-zinc-700"><p className="text-sm"><strong className="text-zinc-400">Observações:</strong> {order.notes}</p></div>)}
                    </div>
                )}
                <DialogFooter><Button variant="ghost" className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}