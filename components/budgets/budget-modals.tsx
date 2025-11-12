'use client'
import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Label } from "@/components/ui/label"
import { Product } from "../stock/types/stock"
import { Customer, BudgetItem, Budget, CurrentUser } from "../orders/types/orders"
import { toast } from "sonner"

function thirtyDaysFromNow() {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
}

const todayDate = () => {
    return new Date().toISOString().split('T')[0];
}

const calculateTotal = (items: BudgetItem[]) => items.reduce((total, item) => total + (item.unit_price * item.quantity), 0);

const handleAddItemToList = (
    list: BudgetItem[],
    setList: React.Dispatch<React.SetStateAction<BudgetItem[]>>,
    productId: string,
    quantity: number,
    products: Product[],
    setProductId: (id: string) => void,
    setQuantity: (q: number) => void,
    setErrorFunc: (e: string | null) => void,
    setProductSearch: (s: string) => void
) => {
    setErrorFunc(null);
    if (!productId) { setErrorFunc("Selecione um produto para adicionar."); return; }
    const product = products.find(p => p.id === productId);
    if (!product) { setErrorFunc("Produto não encontrado."); return; }
    const existingItem = list.find(item => item.product_id === product.id);
    if (existingItem) {
        setList(list.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + quantity } : item));
    } else {
        setList([...list, { product_id: product.id, product_name: product.name, quantity: quantity, unit_price: product.price }]);
    }
    setProductId("");
    setQuantity(1);
    setProductSearch("");
};

const handleRemoveItemFromList = (list: BudgetItem[], setList: React.Dispatch<React.SetStateAction<BudgetItem[]>>, productId: string) => {
    setList(list.filter(item => item.product_id !== productId));
};

interface BudgetFormDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    customers: Customer[];
    products: Product[];
    currentUser: CurrentUser | null;
    editingBudget: Budget | null;
    onBudgetSaved: () => void;
}

export function BudgetFormDialog({ isOpen, onOpenChange, customers, products, currentUser, editingBudget, onBudgetSaved }: BudgetFormDialogProps) {
    const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [itemQuantity, setItemQuantity] = useState(1);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [validUntil, setValidUntil] = useState(thirtyDaysFromNow());
    const [formError, setFormError] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const supabase = createClientComponentClient();

    const isEditing = editingBudget !== null;

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editingBudget) {
                setBudgetItems(editingBudget.items);
                setSelectedCustomerId(editingBudget.customer_id);
                setValidUntil(editingBudget.valid_until || thirtyDaysFromNow());
            } else {
                setBudgetItems([]);
                setSelectedCustomerId(null);
                setValidUntil(thirtyDaysFromNow());
            }
            setSelectedProductId("");
            setItemQuantity(1);
            setFormError(null);
            setProductSearch("");
            setIsLoading(false);
            setIsDeleting(false);
        }
    }, [isOpen, editingBudget, isEditing]);

    const handleSubmitBudget = async () => {
        if (budgetItems.length === 0) { setFormError("Adicione pelo menos um produto ao orçamento."); return; }
        setIsLoading(true); setFormError(null);
        
        try {
            const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
            const total_amount = calculateTotal(budgetItems);
            
            if (isEditing && editingBudget) {
                const items_to_insert = budgetItems.map(item => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price
                }));

                const { error } = await supabase.rpc('update_budget_and_items', {
                    budget_id_input: editingBudget.id,
                    new_customer_id: selectedCustomer?.id || null,
                    new_customer_name: selectedCustomer?.name || null,
                    new_valid_until: validUntil,
                    new_total_amount: total_amount,
                    new_items: items_to_insert
                });
                
                if (error) throw error;
                
            } else {
                const insertData = {
                    total_amount,
                    customer_id: selectedCustomer?.id || null,
                    customer_name: selectedCustomer?.name || null,
                    valid_until: validUntil,
                    employee_name: currentUser?.email
                };
                const { data: budgetData, error: insertError } = await supabase.from('budgets').insert(insertData).select().single();
                
                if (insertError) throw insertError;
                
                const itemsToInsert = budgetItems.map(item => ({ budget_id: budgetData.id, ...item }));
                const { error: itemsError } = await supabase.from('budget_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;
            }
            
            toast.success(`Orçamento ${isEditing ? 'atualizado' : 'criado'} com sucesso!`);
            onOpenChange(false);
            onBudgetSaved();
        } catch (err: any) {
            console.error("Erro ao salvar orçamento:", err);
            setFormError("Erro ao salvar o orçamento. Tente novamente.");
            toast.error("Erro ao salvar o orçamento.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteBudget = async () => {
        if (!isEditing || !editingBudget) return;
        if (!window.confirm("Tem certeza que deseja excluir este orçamento? Ele poderá ser recuperado no futuro.")) return;
        setIsDeleting(true);
        try {
            await supabase
                .from('budgets')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', editingBudget.id);

            toast.success("Orçamento excluído com sucesso.");
            onOpenChange(false);
            onBudgetSaved();
        } catch (err) {
            setFormError("Erro ao excluir o orçamento.");
            toast.error("Erro ao excluir o orçamento.");
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                <DialogHeader><DialogTitle>{isEditing ? `Editar Orçamento: ${editingBudget?.budget_code}` : "Adicionar Orçamento"}</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Label className="block text-sm font-medium text-zinc-400 mb-1">Cliente (Opcional)</Label>
                            <Select value={selectedCustomerId || ""} onValueChange={setSelectedCustomerId}><SelectTrigger className="bg-zinc-800 border-zinc-700 cursor-pointer"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer">{customers.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div>
                            <Label className="block text-sm font-medium text-zinc-400 mb-1">Válido até</Label>
                            <Input type="date" value={validUntil} min={todayDate()} onChange={(e) => setValidUntil(e.target.value)} className="w-full h-10 bg-zinc-800 border-zinc-700"/>
                        </div>
                    </div>
                    <Separator className="bg-zinc-700" />
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">Adicionar Itens</h3>
                        <div className="flex flex-wrap items-stretch gap-2">
                            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                <SelectTrigger className="bg-zinc-800 border-zinc-700 flex-1 min-w-[200px] h-10 cursor-pointer">
                                    <SelectValue placeholder="Selecione um produto..." />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer">
                                    <div className="p-2 sticky top-0 bg-zinc-800 z-10">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                            <Input
                                                type="search"
                                                placeholder="Buscar produto..."
                                                className="w-full bg-zinc-700 border-zinc-600 placeholder:text-zinc-400 pl-10"
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {filteredProducts.length > 0 ? filteredProducts.map(p => (
                                            <SelectItem key={p.id} value={p.id} disabled={p.quantity <= 0} className="cursor-pointer">
                                                {p.name} ({p.quantity} disp.)
                                            </SelectItem>
                                        )) : <p className="text-sm text-center text-zinc-400 py-2">Nenhum produto encontrado.</p>}
                                    </div>
                                </SelectContent>
                            </Select>
                            <Input type="number" value={itemQuantity} onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 h-10 text-center bg-zinc-800 border-zinc-700" />
                            <Button onClick={() => handleAddItemToList(budgetItems, setBudgetItems, selectedProductId, itemQuantity, products, setSelectedProductId, setItemQuantity, setFormError, setProductSearch)} className="h-10 bg-zinc-700 hover:bg-zinc-600 text-white cursor-pointer">Adicionar</Button>
                        </div>
                    </div>
                    <div className="flex-grow space-y-2 mt-4">
                        {budgetItems.length === 0 ? <p className="text-zinc-500 text-center py-4">Nenhum item adicionado.</p> : budgetItems.map(item => (
                            <div key={item.product_id} className="flex justify-between items-center text-sm p-3 bg-zinc-800 rounded">
                                <div>
                                    <p>{item.quantity}x {item.product_name}</p>
                                    <p className="text-xs text-zinc-400">{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                                <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-900/20 cursor-pointer" onClick={() => handleRemoveItemFromList(budgetItems, setBudgetItems, item.product_id)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        ))}
                    </div>
                    <div className="pt-4 border-t border-zinc-700 text-right">
                        <p className="text-zinc-400">Valor Total</p>
                        <p className="text-2xl font-bold">{calculateTotal(budgetItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>
                {formError && <p className="text-sm text-red-500 mt-2">{formError}</p>}
                <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-between w-full">
                    {isEditing ? (
                        <Button variant="ghost" className="text-red-500 hover:bg-red-900/20 hover:text-red-400 justify-start sm:justify-center cursor-pointer" onClick={handleDeleteBudget} disabled={isLoading || isDeleting}>
                            {isDeleting ? <Loader2 className="animate-spin" /> : <><Trash2 className="mr-2 h-4 w-4" />Excluir Orçamento</>}
                        </Button>
                    ) : (
                        <div></div>
                    )}
                    <div>
                        <Button variant="ghost" className="hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400 cursor-pointer" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button variant="ghost" className="mr-2 cursor-pointer hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400" onClick={handleSubmitBudget} disabled={isLoading || isDeleting}>
                            {isLoading ? <Loader2 className="animate-spin" /> : (isEditing ? "Salvar Alterações" : "Salvar Orçamento")}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface BudgetDetailsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    budget: Budget | null;
}

export function BudgetDetailsDialog({ isOpen, onOpenChange, budget }: BudgetDetailsDialogProps) {
    const formatDateWithTimezone = (dateString: string) => new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-zinc-900 text-white border-zinc-700">
                <DialogHeader>
                    <DialogTitle>Detalhes do Orçamento: {budget?.budget_code}</DialogTitle>
                    <p className="text-sm text-zinc-400">Cliente: {budget?.customer_name || "Não informado"}</p>
                    <p className="text-sm text-zinc-400">Criado por: {budget?.employee_name || 'N/A'}</p>
                    {budget?.valid_until && <p className="text-sm text-yellow-400">Válido até: {formatDateWithTimezone(budget.valid_until)}</p>}
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto space-y-4 py-4 pr-3">
                    {budget?.items.map(item => (
                        <div key={item.product_id} className="flex justify-between items-center p-3 bg-zinc-800 rounded-md">
                            <div>
                                <p className="font-bold">{item.quantity}x {item.product_name}</p>
                                <p className="text-sm text-zinc-400">{item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} cada</p>
                            </div>
                            <p className="font-semibold">{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    ))}
                </div>
                <div className="pt-4 border-t border-zinc-700 flex justify-between items-center font-bold text-xl">
                    <span>Total:</span>
                    <span>{budget?.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <DialogFooter className="sm:justify-end mt-4">
                    <Button variant="ghost" className="bg-transparent hover:bg-zinc-800 hover:text-white text-zinc-400 cursor-pointer" onClick={() => onOpenChange(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}