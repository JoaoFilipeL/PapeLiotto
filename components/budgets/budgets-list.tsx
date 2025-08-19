"use client"
import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Minus, Trash2, Loader2, Eye } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface Product {
    id: string;       
    name: string;
    price: number;
    quantity: number; 
}

interface BudgetItem {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
}

interface Budget {
    id: number;
    budget_code: string;
    total_amount: number;
    created_at: string;
    items: BudgetItem[];
}

export function BudgetsList() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newBudgetItems, setNewBudgetItems] = useState<BudgetItem[]>([]);
    const [productSearch, setProductSearch] = useState("");
    const [nextBudgetCode, setNextBudgetCode] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

    const supabase = createClientComponentClient();

    const fetchProducts = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('stock')
                .select('id, name, price, quantity')
                .order('name', { ascending: true });
            if (error) throw error;
            setProducts(data.map(p => ({ ...p, price: parseFloat(p.price) })));
        } catch (err: any) {
            setError("Falha ao carregar produtos do estoque.");
            console.error(err);
        }
    }, [supabase]);

    const fetchBudgets = useCallback(async () => {
        setLoading(true);
        try {
            const { data: budgetsData, error: budgetsError } = await supabase
                .from('budgets')
                .select('*')
                .order('created_at', { ascending: false });
            if (budgetsError) throw budgetsError;

            const budgetIds = budgetsData.map(q => q.id);
            const { data: itemsData, error: itemsError } = await supabase
                .from('budget_items')
                .select('*')
                .in('budget_id', budgetIds);
            if (itemsError) throw itemsError;

            const combinedBudgets: Budget[] = budgetsData.map(budget => ({
                ...budget,
                total_amount: parseFloat(budget.total_amount),
                items: itemsData
                    .filter(item => item.budget_id === budget.id)
                    .map(item => ({
                        product_id: item.product_id,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_price: parseFloat(item.unit_price)
                    }))
            }));

            setBudgets(combinedBudgets);
            
            const lastId = budgetsData.length > 0 ? Math.max(...budgetsData.map(q => parseInt(q.budget_code.split('-')[1]))) : 0;
            setNextBudgetCode(`ORC-${(lastId + 1).toString().padStart(4, '0')}`);

        } catch (err: any) {
            setError("Falha ao carregar orçamentos.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchProducts();
        fetchBudgets();

        const channel = supabase
            .channel('budgets_realtime_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => fetchBudgets())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_items' }, () => fetchBudgets())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchBudgets, fetchProducts]);

    const handleAddProductToBudget = (product: Product) => {
        const existingItem = newBudgetItems.find(item => item.product_id === product.id);
        if (existingItem) {
            setNewBudgetItems(newBudgetItems.map(item =>
                item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            ));
        } else {
            setNewBudgetItems([...newBudgetItems, {
                product_id: product.id,
                product_name: product.name,
                quantity: 1,
                unit_price: product.price
            }]);
        }
    };
    
    const updateItemQuantity = (productId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            setNewBudgetItems(newBudgetItems.filter(item => item.product_id !== productId));
        } else {
            setNewBudgetItems(newBudgetItems.map(item =>
                item.product_id === productId ? { ...item, quantity: newQuantity } : item
            ));
        }
    };

    const calculateTotal = (items: BudgetItem[]) => {
        return items.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
    };

    const handleCreateBudget = async () => {
        if (newBudgetItems.length === 0) {
            setFormError("Adicione pelo menos um produto ao orçamento.");
            return;
        }

        setLoading(true);
        setFormError(null);

        try {
            const total_amount = calculateTotal(newBudgetItems);
            const { data: budgetData, error: budgetError } = await supabase
                .from('budgets')
                .insert({ budget_code: nextBudgetCode, total_amount })
                .select()
                .single();

            if (budgetError) throw budgetError;

            const itemsToInsert = newBudgetItems.map(item => ({
                budget_id: budgetData.id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
            }));

            const { error: itemsError } = await supabase
                .from('budget_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            setNewBudgetItems([]);
            setProductSearch("");
            setIsAddDialogOpen(false);
            
        } catch (err: any) {
            setFormError("Erro ao salvar o orçamento. Tente novamente.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(productSearch.toLowerCase()) && p.quantity > 0
    );

    const filteredBudgets = budgets.filter(q => 
        q.budget_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const openDetailsDialog = (budget: Budget) => {
        setSelectedBudget(budget);
        setIsDetailsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-white">Orçamentos</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <Input
                            type="search"
                            placeholder="Buscar orçamentos..."
                            className="pl-10 w-full bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-white text-black hover:bg-gray-200">
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar Orçamento
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                            <DialogHeader>
                                <DialogTitle>Adicionar orçamento: <span className="text-zinc-400">{nextBudgetCode}</span></DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-6 py-4 max-h-[70vh] overflow-y-auto">
                                <div className="space-y-4 pr-4 border-r border-zinc-700">
                                    <Input 
                                        placeholder="Buscar Produtos..."
                                        className="bg-zinc-800 border-zinc-700"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                    />
                                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                                        {filteredProducts.map(product => (
                                            <div key={product.id} className="flex justify-between items-center p-2 rounded-md hover:bg-zinc-800">
                                                <div>
                                                    <p>{product.name}</p>
                                                    <p className="text-sm text-zinc-400">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                </div>
                                                <Button size="sm" onClick={() => handleAddProductToBudget(product)}>Adicionar</Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">Itens do Orçamento</h3>
                                    <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                                        {newBudgetItems.length === 0 ? (
                                            <p className="text-zinc-500">Nenhum produto adicionado.</p>
                                        ) : (
                                            newBudgetItems.map(item => (
                                                <div key={item.product_id} className="flex justify-between items-center p-2 bg-zinc-800 rounded-md">
                                                    <div>
                                                        <p className="font-medium">{item.product_name}</p>
                                                        <p className="text-sm text-zinc-400">
                                                            {(item.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button size="icon" variant="ghost" onClick={() => updateItemQuantity(item.product_id, item.quantity - 1)}><Minus className="h-4 w-4"/></Button>
                                                        <Input 
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItemQuantity(item.product_id, parseInt(e.target.value) || 1)}
                                                            className="w-16 h-8 text-center bg-zinc-700 border-zinc-600"
                                                        />
                                                        <Button size="icon" variant="ghost" onClick={() => updateItemQuantity(item.product_id, item.quantity + 1)}><Plus className="h-4 w-4"/></Button>
                                                        <Button size="icon" variant="ghost" className="text-red-500" onClick={() => updateItemQuantity(item.product_id, 0)}><Trash2 className="h-4 w-4"/></Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="pt-4 border-t border-zinc-700">
                                        <div className="flex justify-between text-xl font-bold">
                                            <p>Total:</p>
                                            <p>{calculateTotal(newBudgetItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {formError && <p className="text-sm text-red-500 mt-2">{formError}</p>}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={handleCreateBudget} disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Salvar Orçamento
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <div className="space-y-2">
                {loading && <p className="text-center text-zinc-400">Carregando...</p>}
                {!loading && filteredBudgets.map(budget => (
                    <div key={budget.id} className="flex items-center justify-between bg-zinc-800 p-4 rounded-lg hover:bg-zinc-700 transition-colors">
                        <div className="flex-1 font-mono text-white">{budget.budget_code}</div>
                        <div className="flex-1 text-zinc-400 text-center">{formatDate(budget.created_at)}</div>
                        <div className="flex-1 text-zinc-400 text-center">{budget.items.length} Itens</div>
                        <div className="flex-1 text-white font-semibold text-right">{budget.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div className="pl-4">
                           <Button variant="ghost" size="icon" onClick={() => openDetailsDialog(budget)}>
                                <Eye className="h-5 w-5 text-zinc-400" />
                           </Button>
                        </div>
                    </div>
                ))}
            </div>
             <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-2xl bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Orçamento: {selectedBudget?.budget_code}</DialogTitle>
                        <DialogDescription>Criado em: {selectedBudget && formatDate(selectedBudget.created_at)}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto space-y-4 py-4">
                        {selectedBudget?.items.map(item => (
                            <div key={item.product_id} className="flex justify-between items-center p-3 bg-zinc-800 rounded-md">
                                <div>
                                    <p className="font-bold">{item.quantity}x {item.product_name}</p>
                                    <p className="text-sm text-zinc-400">
                                        {item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} cada
                                    </p>
                                </div>
                                <p className="font-semibold">
                                    {(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="pt-4 border-t border-zinc-700 flex justify-between items-center font-bold text-xl">
                        <span>Total:</span>
                        <span>{selectedBudget?.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}