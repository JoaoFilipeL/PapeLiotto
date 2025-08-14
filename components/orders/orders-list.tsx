"use client"
import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Loader2, Eye, Trash2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// --- Interfaces de Tipos ---
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

// --- Componente Principal ---
export function OrdersList() {
    // --- Estados ---
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Estados do Modal de Adicionar Pedido ---
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [nextOrderCode, setNextOrderCode] = useState("");
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
    const [selectedAddress, setSelectedAddress] = useState("");
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<string>("");
    const [newOrderItems, setNewOrderItems] = useState<OrderItem[]>([]);
    const [productSearch, setProductSearch] = useState("");

    const supabase = createClientComponentClient();

    // --- Funções de Busca de Dados ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Customers
            const { data: customersData, error: customersError } = await supabase.from('customers').select('*');
            if (customersError) throw customersError;
            setCustomers(customersData);

            // Fetch Products
            const { data: productsData, error: productsError } = await supabase.from('stock').select('*');
            if (productsError) throw productsError;
            setProducts(productsData.map(p => ({ ...p, price: parseFloat(p.price) })));

            // Fetch Orders and their Items
            const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
            if (ordersError) throw ordersError;

            const orderIds = ordersData.map(o => o.id);
            const { data: itemsData, error: itemsError } = await supabase.from('order_items').select('*').in('order_id', orderIds);
            if (itemsError) throw itemsError;

            const combinedOrders: Order[] = ordersData.map(order => ({
                ...order,
                total_amount: parseFloat(order.total_amount),
                items: itemsData.filter(item => item.order_id === order.id)
            }));
            
            setOrders(combinedOrders);

            const lastId = ordersData.length > 0 ? Math.max(...ordersData.map(o => parseInt(o.order_code.split('-')[1]))) : 0;
            setNextOrderCode(`PED-${(lastId + 1).toString().padStart(4, '0')}`);

        } catch (err: any) {
            setError("Falha ao carregar dados. Verifique o console para mais detalhes.");
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
    
    // --- Funções do Modal ---
    const handleCustomerSelect = (customerId: string) => {
        setSelectedCustomerId(customerId);
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            setSelectedAddress(customer.address || "");
        }
    };

    const handleAddProductToOrder = (product: Product) => {
        const existingItem = newOrderItems.find(item => item.product_id === product.id);
        if (existingItem) {
            if (existingItem.quantity < product.quantity) {
                setNewOrderItems(newOrderItems.map(item =>
                    item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                ));
            } else {
                setFormError(`Estoque máximo atingido para ${product.name}`);
            }
        } else {
            if (product.quantity > 0) {
                setNewOrderItems([...newOrderItems, {
                    product_id: product.id,
                    product_name: product.name,
                    quantity: 1,
                    unit_price: product.price
                }]);
            }
        }
    };

    const handleCreateOrder = async () => {
        // Validações
        if (!selectedCustomerId || newOrderItems.length === 0 || !paymentMethod) {
            setFormError("Preencha todos os campos obrigatórios: Cliente, Forma de Pagamento e adicione ao menos um item.");
            return;
        }

        setLoading(true);
        setFormError(null);

        try {
            // 1. Verificação de estoque
            for (const item of newOrderItems) {
                const productInStock = products.find(p => p.id === item.product_id);
                if (!productInStock || productInStock.quantity < item.quantity) {
                    throw new Error(`Estoque insuficiente para "${item.product_name}". Disponível: ${productInStock?.quantity || 0}.`);
                }
            }
            
            const customer = customers.find(c => c.id === selectedCustomerId);
            if (!customer) throw new Error("Cliente não encontrado.");

            // 2. Inserir o pedido
            const total_amount = newOrderItems.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    order_code: nextOrderCode,
                    customer_id: selectedCustomerId,
                    customer_name: customer.name,
                    address: selectedAddress,
                    order_date: orderDate,
                    payment_method: paymentMethod,
                    total_amount: total_amount,
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 3. Inserir os itens do pedido
            const itemsToInsert = newOrderItems.map(item => ({
                order_id: orderData.id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
            }));
            const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            // 4. ATUALIZAR O ESTOQUE (operação crítica)
            for (const item of newOrderItems) {
                const product = products.find(p => p.id === item.product_id);
                const newQuantity = (product?.quantity || 0) - item.quantity;
                const { error: stockUpdateError } = await supabase
                    .from('stock')
                    .update({ quantity: newQuantity })
                    .eq('id', item.product_id);
                if (stockUpdateError) throw new Error(`Falha ao atualizar estoque para ${item.product_name}.`);
            }

            // 5. Limpar e fechar
            setIsAddDialogOpen(false);
            setNewOrderItems([]);
            setSelectedCustomerId("");
            setSelectedAddress("");
            setPaymentMethod("");
            setProductSearch("");

        } catch (err: any) {
            setFormError(err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    const filteredOrders = orders.filter(o =>
        o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.order_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-white">Pedidos</h1>
                <div className="flex items-center gap-4">
                     <Input
                        type="search"
                        placeholder="Buscar pedidos..."
                        className="pl-10 w-full bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Button className="bg-white text-black hover:bg-gray-200" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Pedido
                    </Button>
                </div>
            </div>

            {/* Lista de Pedidos */}
            <div className="space-y-2">
                {loading && <p className="text-center text-zinc-400">Carregando...</p>}
                {filteredOrders.map(order => (
                    <div key={order.id} className="grid grid-cols-7 gap-4 items-center bg-zinc-800 p-4 rounded-lg">
                        <span className="font-mono text-white">{order.order_code}</span>
                        <span className="text-zinc-300 truncate">{order.customer_name}</span>
                        <span className="text-zinc-300 truncate">{order.address}</span>
                        <span className="text-zinc-300 text-center">{new Date(order.order_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        <span className="text-zinc-300 text-center">{order.items.reduce((acc, item) => acc + item.quantity, 0)} itens</span>
                        <span className="text-zinc-300 text-center">{order.payment_method}</span>
                        <span className="text-white font-semibold text-right">{order.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                ))}
            </div>
            
            {/* Modal de Adicionar Pedido */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-4xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Adicionar Pedido: {nextOrderCode}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-6 py-4 max-h-[70vh]">
                        {/* Coluna da Esquerda: Dados do Pedido */}
                        <div className="space-y-4 pr-4 border-r border-zinc-700">
                             <Select onValueChange={handleCustomerSelect}>
                                <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue placeholder="Selecione o Cliente*" /></SelectTrigger>
                                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input placeholder="Endereço" value={selectedAddress} onChange={e => setSelectedAddress(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                            <Select onValueChange={setPaymentMethod}>
                                <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue placeholder="Forma de Pagamento*" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PIX">PIX</SelectItem>
                                    <SelectItem value="Crédito">Crédito</SelectItem>
                                    <SelectItem value="Débito">Débito</SelectItem>
                                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                </SelectContent>
                            </Select>
                             <div className="pt-4 border-t border-zinc-700 text-right">
                                <p className="text-zinc-400">Itens: {newOrderItems.reduce((acc, item) => acc + item.quantity, 0)}</p>
                                <p className="text-2xl font-bold">
                                    Total: {newOrderItems.reduce((acc, item) => acc + item.unit_price * item.quantity, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                        </div>

                        {/* Coluna da Direita: Itens */}
                        <div className="flex flex-col">
                            <Input placeholder="Buscar Produtos..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="bg-zinc-800 border-zinc-700 mb-4" />
                            <div className="flex-grow space-y-2 overflow-y-auto">
                                {newOrderItems.map(item => (
                                    <div key={item.product_id} className="flex justify-between items-center text-sm p-2 bg-zinc-800 rounded">
                                        <span>{item.quantity}x {item.product_name}</span>
                                        <span>{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                ))}
                                {productSearch && filteredProducts.map(p => (
                                    <div key={p.id} className="flex justify-between items-center p-2 rounded cursor-pointer hover:bg-zinc-800" onClick={() => handleAddProductToOrder(p)}>
                                        <span>{p.name} ({p.quantity})</span>
                                        <span>{p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {formError && <p className="text-sm text-red-500">{formError}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateOrder} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Adicionar Pedido"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}