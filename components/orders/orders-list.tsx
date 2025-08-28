"use client"
import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Loader2, Edit, Trash2, Archive, Eye, Minus, Users, MoreVertical, FileDown, Printer, ChevronsUpDown, ArrowUpNarrowWide, ArrowDownNarrowWide } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { createClientComponentClient, User } from '@supabase/auth-helpers-nextjs'
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface Product {
    id: string; name: string; price: number; quantity: number;
}
interface Customer {
    id: string; name: string; phone?: string; address?: string;
}
interface OrderItem {
    product_id: string; product_name: string; quantity: number; unit_price: number;
}
interface Order {
    id: number; order_code: string; customer_id: string; customer_name: string; customer_phone?: string; address: string; order_date: string; payment_method: string; total_amount: number; items: OrderItem[]; notes: string | null; delivery_time: string | null; delivery_fee: number; created_at: string; status: string; employee_name: string | null;
}

const getOrderHtml = (order: Order): string => {
    const itemsHtml = order.items.map(item => `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px;">${item.product_name}</td><td style="padding: 8px; text-align: center;">${item.quantity}</td><td style="padding: 8px; text-align: right;">${item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td style="padding: 8px; text-align: right;">${(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>`).join('');
    const deliveryFeeHtml = `<tr style="border-top: 2px solid #ddd;"><td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Taxa de Entrega:</td><td style="padding: 8px; text-align: right; font-weight: bold;">${order.delivery_fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>`;
    return `<html><head><title>Pedido ${order.order_code}</title><style>body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; } .header, .customer-details { margin-bottom: 20px; } .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #ccc; } .header h1 { font-size: 24px; font-weight: bold; margin: 0; } .header .details { text-align: right; } .header .details p { margin: 0; font-size: 14px; } .customer-details p { margin: 2px 0; } .total-box { display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; padding: 8px; background-color: #F3F4F6; border-radius: 4px; }</style></head>
            <body><div style="padding: 32px; width: 210mm; margin: auto;">
                    <div class="header"><h1>Detalhes do Pedido</h1><div class="details"><p style="font-family: monospace; font-size: 18px; font-weight: bold;">${order.order_code}</p><p>Data do Pedido: ${new Date(order.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p><p>Data da Entrega: ${new Date(order.order_date + 'T00:00:00').toLocaleDateString('pt-BR')} às ${order.delivery_time}</p></div></div>
                    <div class="customer-details"><h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Cliente:</h2><p><strong>Nome:</strong> ${order.customer_name}</p><p><strong>Telefone:</strong> ${order.customer_phone || 'N/A'}</p><p><strong>Endereço:</strong> ${order.address}</p><p><strong>Pagamento:</strong> ${order.payment_method}</p><p><strong>Atendente:</strong> ${order.employee_name || 'N/A'}</p></div>
                    <div><h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Itens:</h2><table><thead><tr style="border-bottom: 1px solid #ddd;"><th style="padding: 8px; text-align: left;">Produto</th><th style="padding: 8px; text-align: center;">Qtd.</th><th style="padding: 8px; text-align: right;">Preço Unit.</th><th style="padding: 8px; text-align: right;">Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody><tfoot>${deliveryFeeHtml}</tfoot></table></div>
                    <div style="display: flex; justify-content: flex-end; margin-top: 32px;"><div style="width: 50%;"><div class="total-box"><span>Total:</span><span>${order.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div></div></div>
                    ${order.notes ? `<div style="margin-top: 20px;"><p><strong>Observações:</strong> ${order.notes}</p></div>` : ''}
            </div></body></html>`;
};

export function OrdersList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [addFormError, setAddFormError] = useState<string | null>(null);
    const [nextOrderCode, setNextOrderCode] = useState("");
    const [addSelectedCustomerId, setAddSelectedCustomerId] = useState<string>("");
    const [addAddress, setAddAddress] = useState("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const [addOrderDate, setAddOrderDate] = useState(todayString);
    const [addPaymentMethod, setAddPaymentMethod] = useState<string>("");
    const [addOrderItems, setAddOrderItems] = useState<OrderItem[]>([]);
    const [addSelectedProductId, setAddSelectedProductId] = useState<string>("");
    const [addItemQuantity, setAddItemQuantity] = useState(1);
    const [addNotes, setAddNotes] = useState("");
    const [addDeliveryTime, setAddDeliveryTime] = useState("12:00");
    const [addDeliveryFee, setAddDeliveryFee] = useState("0");
    const [minTime, setMinTime] = useState("00:00");
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [editCustomerId, setEditCustomerId] = useState<string>("");
    const [editAddress, setEditAddress] = useState("");
    const [editOrderDate, setEditOrderDate] = useState("");
    const [editPaymentMethod, setEditPaymentMethod] = useState("");
    const [editOrderItems, setEditOrderItems] = useState<OrderItem[]>([]);
    const [editStatus, setEditStatus] = useState<string>("");
    const [editSelectedProductId, setEditSelectedProductId] = useState<string>("");
    const [editItemQuantity, setEditItemQuantity] = useState(1);
    const [editNotes, setEditNotes] = useState("");
    const [editDeliveryTime, setEditDeliveryTime] = useState("12:00");
    const [editDeliveryFee, setEditDeliveryFee] = useState("0");
    const [editFormError, setEditFormError] = useState<string | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
    const [isAddProductPopoverOpen, setIsAddProductPopoverOpen] = useState(false);
    const [isEditProductPopoverOpen, setIsEditProductPopoverOpen] = useState(false);
    const supabase = createClientComponentClient();
    
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        fetchUser();
    }, [supabase]);

    useEffect(() => {
        if (addOrderDate === todayString) {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5);
            setMinTime(currentTime);
            if (addDeliveryTime < currentTime) setAddDeliveryTime(currentTime);
        } else {
            setMinTime("00:00");
        }
    }, [addOrderDate, todayString, addDeliveryTime]);

    const handlePrint = (order: Order) => {
        const htmlContent = getOrderHtml(order);
        const printWindow = window.open('', '', 'height=800,width=800');
        if (printWindow) { printWindow.document.write(htmlContent); printWindow.document.close(); printWindow.focus(); printWindow.print(); }
    };

    const handleSaveAsPdf = (order: Order) => {
        const htmlContent = getOrderHtml(order);
        const printWindow = window.open('', '', 'height=800,width=800');
        if (printWindow) {
            printWindow.document.write(htmlContent); printWindow.document.close();
            setTimeout(() => {
                const elementToCapture = printWindow.document.body.children[0] as HTMLElement;
                if (elementToCapture) {
                    html2canvas(elementToCapture, { scale: 2, useCORS: true }).then(canvas => {
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                        pdf.save(`pedido-${order.order_code}.pdf`);
                        printWindow.close();
                    });
                } else { printWindow.close(); }
            }, 500);
        }
    };

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
            const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').order('created_at', { ascending: sortOrder === 'asc' });
            if (ordersError) throw ordersError;
            const orderIds = ordersData.map(o => o.id);
            const { data: itemsData, error: itemsError } = await supabase.from('order_items').select('*').in('order_id', orderIds);
            if (itemsError) throw itemsError;
            const combinedOrders: Order[] = ordersData.map(order => {
                const customer = customersData.find(c => c.id === order.customer_id);
                return { ...order, customer_phone: customer?.phone, total_amount: parseFloat(order.total_amount as any), items: itemsData.filter(item => item.order_id === order.id).map(item => ({...item, unit_price: parseFloat(item.unit_price as any)})) }
            });
            setOrders(combinedOrders);
            const lastId = ordersData.length > 0 ? Math.max(...ordersData.map(o => parseInt(o.order_code.split('-')[1]))) : 0;
            setNextOrderCode(`PED-${(lastId + 1).toString().padStart(4, '0')}`);
        } catch (err) {
            setError("Falha ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [supabase, sortOrder]);

    useEffect(() => {
        fetchData();
        const channel = supabase.channel('orders_realtime').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [supabase, fetchData]);

    useEffect(() => {
        if (addSelectedCustomerId) {
            const customer = customers.find(c => c.id === addSelectedCustomerId);
            if (customer) { setAddAddress(customer.address || ""); }
        } else {
            setAddAddress("");
        }
    }, [addSelectedCustomerId, customers]);

    const calculateTotal = (items: OrderItem[], fee: string) => {
        const itemsTotal = items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
        return itemsTotal + (parseFloat(fee) || 0);
    };

    const resetAddForm = () => {
        setAddSelectedCustomerId(""); setAddAddress(""); setAddOrderDate(todayString); setAddPaymentMethod(""); setAddOrderItems([]); setAddSelectedProductId(""); setAddItemQuantity(1); setAddNotes(""); setAddDeliveryTime("12:00"); setAddDeliveryFee("0"); setAddFormError(null);
    };

    const handleCreateOrder = async () => {
        if (!addSelectedCustomerId || addOrderItems.length === 0 || !addPaymentMethod) { setAddFormError("Preencha: Cliente, Forma de Pagamento e adicione ao menos um item."); return; }
        setLoading(true); setAddFormError(null);
        try {
            for (const item of addOrderItems) {
                const productInStock = products.find(p => p.id === item.product_id);
                if (!productInStock || productInStock.quantity < item.quantity) { throw new Error(`Estoque insuficiente para "${item.product_name}".`); }
            }
            const customer = customers.find(c => c.id === addSelectedCustomerId);
            if (!customer) throw new Error("Cliente não encontrado.");
            const total_amount = calculateTotal(addOrderItems, addDeliveryFee);
            const { data: orderData, error: orderError } = await supabase.from('orders').insert({ order_code: nextOrderCode, customer_id: addSelectedCustomerId, customer_name: customer.name, address: addAddress, order_date: addOrderDate, payment_method: addPaymentMethod, total_amount: total_amount, notes: addNotes, delivery_time: addDeliveryTime, delivery_fee: parseFloat(addDeliveryFee) || 0, status: 'Pendente', employee_name: currentUser?.email }).select().single();
            if (orderError) throw orderError;
            const itemsToInsert = addOrderItems.map(item => ({ order_id: orderData.id, ...item }));
            const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
            for (const item of addOrderItems) {
                const product = products.find(p => p.id === item.product_id);
                const newQuantity = (product?.quantity || 0) - item.quantity;
                const { error: stockUpdateError } = await supabase.from('stock').update({ quantity: newQuantity }).eq('id', item.product_id);
                if (stockUpdateError) throw new Error(`Falha ao atualizar estoque para ${item.product_name}.`);
            }
            setIsAddDialogOpen(false); resetAddForm();
        } catch (err) {
            if (err instanceof Error) setAddFormError(err.message);
            else setAddFormError("Ocorreu um erro desconhecido.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateOrder = async () => {
        if (!editingOrder || !editCustomerId || editOrderItems.length === 0) { setEditFormError("Cliente e itens são obrigatórios."); return; }
        setLoading(true); setEditFormError(null);
        try {
            const originalItems = editingOrder.items; const stockAdjustments = new Map<string, number>();
            originalItems.forEach(item => { stockAdjustments.set(item.product_id, (stockAdjustments.get(item.product_id) || 0) + item.quantity); });
            editOrderItems.forEach(item => { stockAdjustments.set(item.product_id, (stockAdjustments.get(item.product_id) || 0) - item.quantity); });
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
            const { error: orderUpdateError } = await supabase.from('orders').update({ customer_id: editCustomerId, customer_name: customer.name, address: editAddress, order_date: editOrderDate, payment_method: editPaymentMethod, total_amount, notes: editNotes, delivery_time: editDeliveryTime, delivery_fee: parseFloat(editDeliveryFee) || 0, status: editStatus }).eq('id', editingOrder.id);
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

    const openDetailsDialog = (order: Order) => { setSelectedOrderDetails(order); setIsDetailsDialogOpen(true); };
    const openEditDialog = (order: Order) => { setEditingOrder(order); setEditCustomerId(order.customer_id); setEditAddress(order.address || ""); setEditOrderDate(order.order_date); setEditPaymentMethod(order.payment_method); setEditOrderItems(order.items); setEditStatus(order.status); setEditNotes(order.notes || ""); setEditDeliveryTime(order.delivery_time || "12:00"); setEditDeliveryFee(order.delivery_fee?.toString() || "0"); setEditFormError(null); setEditSelectedProductId(""); setEditItemQuantity(1); setIsEditDialogOpen(true); };
    const handleAddItemToList = (list: OrderItem[], setList: React.Dispatch<React.SetStateAction<OrderItem[]>>, productId: string, quantity: number, setProductId: (id: string) => void, setQuantity: (q: number) => void, setErrorFunc: (e: string | null) => void) => {
        setErrorFunc(null); if (!productId) { setErrorFunc("Selecione um produto para adicionar."); return; }
        const product = products.find(p => p.id === productId); if (!product) { setErrorFunc("Produto não encontrado."); return; }
        const existingItem = list.find(item => item.product_id === product.id);
        const totalQuantityInOrder = existingItem ? existingItem.quantity : 0;
        if (product.quantity < totalQuantityInOrder + quantity) { setErrorFunc(`Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}`); return; }
        if (existingItem) { setList(list.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + quantity } : item ));
        } else { setList([...list, { product_id: product.id, product_name: product.name, quantity: quantity, unit_price: product.price }]); }
        setProductId(""); setQuantity(1);
    };
    const handleRemoveItemFromList = (list: OrderItem[], setList: React.Dispatch<React.SetStateAction<OrderItem[]>>, productId: string) => { setList(list.filter(item => item.product_id !== productId)); };
    const filteredOrders = orders.filter(o => (o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || o.order_code.toLowerCase().includes(searchTerm.toLowerCase())) || (o.customer_phone && o.customer_phone.includes(searchTerm)));
    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'Entregue': return 'default';
            case 'Cancelado': return 'destructive';
            case 'Saiu para Entrega': return 'outline';
            default: return 'secondary';
        }
    };

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                <h1 className="text-white text-3xl font-bold">Pedidos</h1>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 w-full md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" /><Input type="search" placeholder="Buscar pedidos..." className="pl-10 w-full bg-[#1C1C1C] text-white border-zinc-600 placeholder:text-zinc-500 rounded-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    <Button variant="outline" size="icon" onClick={() => setSortOrder(current => current === 'asc' ? 'desc' : 'asc')} className="bg-transparent text-white hover:bg-zinc-700 hover:text-white">{sortOrder === 'desc' ? <ArrowDownNarrowWide className="h-5 w-5" /> : <ArrowUpNarrowWide className="h-5 w-5" />}</Button>
                    <Link href="/orders/customers" passHref><Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer"><Users className="h-5 w-5" />Gerenciar Clientes</Button></Link>
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer" onClick={() => setIsAddDialogOpen(true)}><Archive className="h-5 w-5" />Adicionar Pedido</Button>
                </div>
            </div>

            {loading && <div className="text-center text-white py-8"><Loader2 className="h-10 w-10 animate-spin text-white mx-auto" /><p className="mt-3">Carregando...</p></div>}
            {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md">{error}</div>}

            {!loading && !error && filteredOrders.length > 0 && (
                <div className="hidden md:grid md:grid-cols-12 items-center px-3 pb-2 mb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="col-span-2">Pedido</div><div className="col-span-3">Cliente</div><div className="col-span-2">Status</div><div className="col-span-2">Pagamento</div><div className="col-span-2 text-right">Total</div><div className="col-span-1 text-right">Ações</div>
                </div>
            )}
            
            <div className="space-y-2">
                {!loading && filteredOrders.map(order => (
                    <div key={order.id} className="grid grid-cols-2 md:grid-cols-12 items-center bg-[#1C1C1C] p-3 rounded-lg hover:bg-zinc-800 transition-colors duration-200 cursor-pointer" onClick={() => openEditDialog(order)}>
                        <div className="md:col-span-2 text-white font-medium truncate"><span className="md:hidden font-semibold text-zinc-400">Pedido: </span>{order.order_code}</div>
                        <div className="md:col-span-3 text-zinc-400 truncate"><span className="md:hidden font-semibold">Cliente: </span>{order.customer_name}</div>
                        <div className="md:col-span-2 text-zinc-400 truncate"><Badge variant={getStatusVariant(order.status)}>{order.status}</Badge></div>
                        <div className="md:col-span-2 text-zinc-400 truncate"><span className="md:hidden font-semibold">Pgto: </span>{order.payment_method}</div>
                        <div className="md:col-span-2 text-right text-white font-semibold truncate col-span-2 md:col-span-2"><span className="md:hidden font-semibold text-zinc-400">Total: </span>{order.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div className="md:col-span-1 flex justify-end items-center col-span-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => openDetailsDialog(order)}><Eye className="h-5 w-5 text-zinc-400" /></Button>
                            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="cursor-pointer"><MoreVertical className="h-5 w-5 text-zinc-400" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-zinc-800 text-white border-zinc-700">
                                    <DropdownMenuItem className="cursor-pointer focus:bg-zinc-700 focus:text-white" onSelect={() => handleSaveAsPdf(order)}><FileDown className="mr-2 h-4 w-4"/>Salvar em PDF</DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer focus:bg-zinc-700 focus:text-white" onSelect={() => handlePrint(order)}><Printer className="mr-2 h-4 w-4"/>Imprimir</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}
                {!loading && filteredOrders.length === 0 && !error && ( <div className="text-center text-zinc-500 py-10">Nenhum pedido encontrado.</div> )}
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={(isOpen) => { setIsAddDialogOpen(isOpen); if (!isOpen) resetAddForm(); }}>
                <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader><DialogTitle>Adicionar Novo Pedido: {nextOrderCode}</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2"><Label>Cliente</Label><Select value={addSelectedCustomerId} onValueChange={setAddSelectedCustomerId}><SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>Data de Entrega</Label><Input type="date" value={addOrderDate} min={todayString} onChange={e => setAddOrderDate(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                            <div className="space-y-2"><Label>Hora da Entrega</Label><Input type="time" value={addDeliveryTime} min={minTime} onChange={e => setAddDeliveryTime(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                            <div className="space-y-2 col-span-2"><Label>Endereço</Label><Input value={addAddress} onChange={e => setAddAddress(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                            <div className="space-y-2"><Label>Taxa de Entrega (R$)</Label><Input type="number" value={addDeliveryFee} onChange={e => setAddDeliveryFee(e.target.value)} className="bg-zinc-800 border-zinc-700"/></div>
                            <div className="space-y-2"><Label>Forma de Pagamento</Label><Select value={addPaymentMethod} onValueChange={setAddPaymentMethod}><SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent><SelectItem value="PIX">PIX</SelectItem><SelectItem value="Crédito">Crédito</SelectItem><SelectItem value="Débito">Débito</SelectItem><SelectItem value="Dinheiro">Dinheiro</SelectItem></SelectContent></Select></div>
                        </div>
                        <Separator className="bg-zinc-700" />
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Itens do Pedido</h3>
                            <div className="flex flex-wrap items-stretch gap-2">
                                <Popover open={isAddProductPopoverOpen} onOpenChange={setIsAddProductPopoverOpen}><PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="bg-zinc-800 border-zinc-700 flex-1 min-w-[200px] h-10 justify-between font-normal">
                                        {addSelectedProductId ? products.find((p) => p.id === addSelectedProductId)?.name : "Buscar produto..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button></PopoverTrigger>
                                    <PopoverContent className="p-0 w-[--radix-popover-trigger-width]"><Command><CommandInput placeholder="Buscar produto..." /><CommandList><CommandEmpty>Nenhum produto.</CommandEmpty><CommandGroup>
                                        {products.map((p) => (<CommandItem key={p.id} value={p.name} onSelect={() => {setAddSelectedProductId(p.id); setIsAddProductPopoverOpen(false);}} disabled={p.quantity <= 0}>{p.name}</CommandItem>))}
                                    </CommandGroup></CommandList></Command></PopoverContent>
                                </Popover>
                                <div className="flex items-center gap-1"><Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800" onClick={() => setAddItemQuantity(prev => Math.max(1, prev - 1))}><Minus/></Button><Input type="number" value={addItemQuantity} onChange={(e) => setAddItemQuantity(parseInt(e.target.value) || 1)} className="w-16 h-10 text-center bg-zinc-800 border-zinc-700"/><Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800" onClick={() => setAddItemQuantity(prev => prev + 1)}><Plus/></Button></div>
                                <Button onClick={() => handleAddItemToList(addOrderItems, setAddOrderItems, addSelectedProductId, addItemQuantity, setAddSelectedProductId, setAddItemQuantity, setAddFormError)} className="h-10 bg-zinc-700 hover:bg-zinc-600">Adicionar</Button>
                            </div>
                            <div className="flex-grow space-y-2 mt-4">{addOrderItems.map(item => (<div key={item.product_id} className="flex justify-between items-center text-sm p-2 bg-zinc-800 rounded"><div><p>{item.quantity}x {item.product_name}</p></div><Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleRemoveItemFromList(addOrderItems, setAddOrderItems, item.product_id)}><Trash2/></Button></div>))}</div>
                        </div>
                        <div className="space-y-2"><Label>Observações</Label><Textarea value={addNotes} onChange={(e) => setAddNotes(e.target.value)} className="bg-zinc-800 border-zinc-700"/></div>
                        <div className="pt-4 border-t border-zinc-700 text-right"><Label>Valor Total</Label><p className="text-2xl font-bold">{calculateTotal(addOrderItems, addDeliveryFee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                    </div>
                    {addFormError && <p className="text-sm text-red-500 mt-2">{addFormError}</p>}
                    <DialogFooter className="mt-4"><Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button><Button onClick={handleCreateOrder} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Salvar Pedido"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader><DialogTitle>Editar Pedido: {editingOrder?.order_code}</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Cliente</Label><Select value={editCustomerId} onValueChange={setEditCustomerId}><SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>Status</Label><Select value={editStatus} onValueChange={setEditStatus}><SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="Em Separação">Em Separação</SelectItem><SelectItem value="Saiu para Entrega">Saiu para Entrega</SelectItem><SelectItem value="Entregue">Entregue</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Data de Entrega</Label><Input type="date" value={editOrderDate} onChange={e => setEditOrderDate(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                            <div className="space-y-2"><Label>Hora da Entrega</Label><Input type="time" value={editDeliveryTime} onChange={e => setEditDeliveryTime(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                            <div className="space-y-2 col-span-2"><Label>Endereço</Label><Input value={editAddress} onChange={e => setEditAddress(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                            <div className="space-y-2"><Label>Taxa de Entrega (R$)</Label><Input type="number" value={editDeliveryFee} onChange={e => setEditDeliveryFee(e.target.value)} className="bg-zinc-800 border-zinc-700" /></div>
                            <div className="space-y-2"><Label>Pagamento</Label><Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}><SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PIX">PIX</SelectItem><SelectItem value="Crédito">Crédito</SelectItem><SelectItem value="Débito">Débito</SelectItem><SelectItem value="Dinheiro">Dinheiro</SelectItem></SelectContent></Select></div>
                        </div>
                        <Separator className="bg-zinc-700" />
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Itens do Pedido</h3>
                            <div className="flex flex-wrap items-stretch gap-2">
                                <Popover open={isEditProductPopoverOpen} onOpenChange={setIsEditProductPopoverOpen}><PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="bg-zinc-800 border-zinc-700 flex-1 min-w-[200px] h-10 justify-between font-normal">
                                        {editSelectedProductId ? products.find((p) => p.id === editSelectedProductId)?.name : "Buscar produto..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button></PopoverTrigger>
                                    <PopoverContent className="p-0 w-[--radix-popover-trigger-width]"><Command><CommandInput placeholder="Buscar produto..."/><CommandList><CommandEmpty>Nenhum produto.</CommandEmpty><CommandGroup>
                                        {products.map((p) => (<CommandItem key={p.id} value={p.name} onSelect={() => {setEditSelectedProductId(p.id); setIsEditProductPopoverOpen(false);}} disabled={p.quantity <= 0}>{p.name}</CommandItem>))}
                                    </CommandGroup></CommandList></Command></PopoverContent>
                                </Popover>
                                <div className="flex items-center gap-1"><Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800" onClick={() => setEditItemQuantity(prev => Math.max(1, prev - 1))}><Minus/></Button><Input type="number" value={editItemQuantity} onChange={(e) => setEditItemQuantity(parseInt(e.target.value) || 1)} className="w-16 h-10 text-center bg-zinc-800 border-zinc-700"/><Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800" onClick={() => setEditItemQuantity(prev => prev + 1)}><Plus/></Button></div>
                                <Button onClick={() => handleAddItemToList(editOrderItems, setEditOrderItems, editSelectedProductId, editItemQuantity, setEditSelectedProductId, setEditItemQuantity, setEditFormError)} className="h-10 bg-zinc-700 hover:bg-zinc-600">Adicionar</Button>
                            </div>
                            <div className="flex-grow space-y-2 mt-4">{editOrderItems.map(item => (<div key={item.product_id} className="flex justify-between items-center text-sm p-2 bg-zinc-800 rounded"><div><p>{item.quantity}x {item.product_name}</p></div><Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleRemoveItemFromList(editOrderItems, setEditOrderItems, item.product_id)}><Trash2/></Button></div>))}</div>
                        </div>
                        <div className="space-y-2"><Label>Observações</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="bg-zinc-800 border-zinc-700"/></div>
                        <div className="pt-4 border-t border-zinc-700 text-right"><Label>Valor Total</Label><p className="text-2xl font-bold">{calculateTotal(editOrderItems, editDeliveryFee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                    </div>
                    {editFormError && <p className="text-sm text-red-500 mt-2">{editFormError}</p>}
                    <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-between w-full">
                        <Button variant="ghost" className="text-red-500 hover:bg-red-900/20" onClick={() => handleDeleteOrder(editingOrder!.id)} disabled={loading}><Trash2 className="mr-2 h-4 w-4" />Excluir Pedido</Button>
                        <div><Button variant="outline" className="mr-2" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button><Button onClick={handleUpdateOrder} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}</Button></div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-lg bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader><DialogTitle>Detalhes do Pedido: {selectedOrderDetails?.order_code}</DialogTitle></DialogHeader>
                    {selectedOrderDetails && (
                        <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <strong className="text-zinc-400">Cliente:</strong> <span>{selectedOrderDetails.customer_name}</span>
                                <strong className="text-zinc-400">Telefone:</strong> <span>{selectedOrderDetails.customer_phone || 'N/A'}</span>
                                <strong className="text-zinc-400 col-span-2">Endereço:</strong> <span className="col-span-2">{selectedOrderDetails.address}</span>
                                <strong className="text-zinc-400">Data Entrega:</strong> <span>{new Date(selectedOrderDetails.order_date + 'T00:00:00').toLocaleDateString('pt-BR')} às {selectedOrderDetails.delivery_time}</span>
                                <strong className="text-zinc-400">Pagamento:</strong> <span>{selectedOrderDetails.payment_method}</span>
                                <strong className="text-zinc-400">Atendente:</strong> <span>{selectedOrderDetails.employee_name || 'N/A'}</span>
                                <strong className="text-zinc-400">Pedido Criado Em:</strong> <span>{new Date(selectedOrderDetails.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            </div>
                            <Separator className="bg-zinc-700"/>
                            <div><strong>Itens:</strong><div className="mt-2 space-y-1">{selectedOrderDetails.items.map(item => (<div key={item.product_id} className="flex justify-between text-sm"><span>{item.quantity}x {item.product_name}</span><span>{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>))}</div></div>
                            {selectedOrderDetails.delivery_fee > 0 && (<div className="flex justify-between text-sm pt-2 border-t border-zinc-700"><strong>Taxa de Entrega:</strong><span>{selectedOrderDetails.delivery_fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>)}
                            <div className="pt-2 border-t border-zinc-700 text-right font-bold text-lg">Total: {selectedOrderDetails.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                             {selectedOrderDetails.notes && (<div className="pt-2 border-t border-zinc-700"><p className="text-sm"><strong className="text-zinc-400">Observações:</strong> {selectedOrderDetails.notes}</p></div>)}
                        </div>
                    )}
                    <DialogFooter><Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>Fechar</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}