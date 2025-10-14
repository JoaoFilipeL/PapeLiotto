"use client"
import React, { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Trash2, Loader2, Eye, MoreVertical, FileDown, Printer } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { createClientComponentClient, User } from '@supabase/auth-helpers-nextjs'
import { Label } from "@/components/ui/label"
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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
    customer_name: string | null;
    customer_id: string | null;
    customers: { phone: string }[] | null;
    total_amount: number;
    created_at: string;
    valid_until: string | null;
    employee_name: string | null;
    items: BudgetItem[];
}

const getBudgetHtml = (budget: Budget): string => {
    const itemsHtml = budget.items.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px;">${item.product_name}</td>
            <td style="padding: 8px; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; text-align: right;">${item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style="padding: 8px; text-align: right;">${(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        </tr>
    `).join('');
    const creationDate = new Date(budget.created_at);
    const validUntilDate = budget.valid_until ? new Date(budget.valid_until + 'T00:00:00') : null;

    return `
        <html>
            <head><title>Orçamento ${budget.budget_code}</title><style>body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; } .header, .customer-details { margin-bottom: 20px; } .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #ccc; } .header h1 { font-size: 24px; font-weight: bold; margin: 0; } .header .details { text-align: right; } .header .details p { margin: 0; font-size: 14px; } .customer-details p { margin: 2px 0; } .total-box { display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; padding: 8px; background-color: #F3F4F6; border-radius: 4px; }</style></head>
            <body><div style="padding: 32px; width: 210mm; margin: auto;">
                    <div class="header"><h1>Orçamento</h1><div class="details"><p style="font-family: monospace; font-size: 18px; font-weight: bold;">${budget.budget_code}</p><p>Data: ${creationDate.toLocaleDateString('pt-BR')}</p>${validUntilDate ? `<p>Válido até: ${validUntilDate.toLocaleDateString('pt-BR')}</p>` : ''}</div></div>
                    <div class="customer-details"><h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Cliente:</h2><p><strong>Nome:</strong> ${budget.customer_name || 'Não informado'}</p><p><strong>Telefone:</strong> ${budget.customers?.[0]?.phone || 'N/A'}</p><p><strong>Atendido por:</strong> ${budget.employee_name || 'N/A'}</p></div>
                    <div><h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Itens:</h2><table><thead><tr style="border-bottom: 1px solid #ddd;"><th style="padding: 8px; text-align: left;">Produto</th><th style="padding: 8px; text-align: center;">Qtd.</th><th style="padding: 8px; text-align: right;">Preço Unit.</th><th style="padding: 8px; text-align: right;">Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table></div>
                    <div style="display: flex; justify-content: flex-end; margin-top: 32px;"><div style="width: 50%;"><div class="total-box"><span>Total:</span><span>${budget.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div></div></div>
            </div></body></html>`;
};

export function BudgetsList() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [addBudgetItems, setAddBudgetItems] = useState<BudgetItem[]>([]);
    const [addSelectedProductId, setAddSelectedProductId] = useState("");
    const [addItemQuantity, setAddItemQuantity] = useState(1);
    const [addSelectedCustomerId, setAddSelectedCustomerId] = useState<string | null>(null);
    const [addValidUntil, setAddValidUntil] = useState(thirtyDaysFromNow());
    const [addFormError, setAddFormError] = useState<string | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [productSearch, setProductSearch] = useState("");
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [editFormError, setEditFormError] = useState<string | null>(null);
    const [editSelectedCustomerId, setEditSelectedCustomerId] = useState<string | null>(null);
    const [editValidUntil, setEditValidUntil] = useState("");
    const [editBudgetItems, setEditBudgetItems] = useState<BudgetItem[]>([]);
    const [editSelectedProductId, setEditSelectedProductId] = useState("");
    const [editItemQuantity, setEditItemQuantity] = useState(1);
    const supabase = createClientComponentClient();

    function thirtyDaysFromNow() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toISOString().split('T')[0];
    }

    const todayDate = () => {
        return new Date().toISOString().split('T')[0];
    }

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        fetchUser();
    }, [supabase]);

    const handlePrint = (budget: Budget) => {
        const htmlContent = getBudgetHtml(budget);
        const printWindow = window.open('', '', 'height=800,width=800');
        if (printWindow) { printWindow.document.write(htmlContent); printWindow.document.close(); printWindow.focus(); printWindow.print(); }
    };

    const handleSaveAsPdf = (budget: Budget) => {
        const htmlContent = getBudgetHtml(budget);
        const printWindow = window.open('', '', 'height=800,width=800');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            setTimeout(() => {
                const elementToCapture = printWindow.document.body.children[0] as HTMLElement;
                if(elementToCapture) {
                    html2canvas(elementToCapture).then(canvas => {
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                        pdf.save(`orcamento-${budget.budget_code}.pdf`);
                        printWindow.close();
                    });
                } else { printWindow.close(); }
            }, 500);
        }
    };
    
    const fetchData = useCallback(async () => {
        setError(null);
        try {
            const { data: productsData, error: productsError } = await supabase.from('stock').select('*').order('name');
            if (productsError) throw productsError;
            setProducts(productsData.map(p => ({ ...p, price: parseFloat(p.price as any) })));

            const { data: customersData, error: customersError } = await supabase.from('customers').select('*').order('name');
            if (customersError) throw customersError;
            setCustomers(customersData);

            const { data: budgetsData, error: budgetsError } = await supabase
                .from('budgets')
                .select('*, customers(phone)')
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (budgetsError) throw budgetsError;

            const budgetIds = budgetsData.map(q => q.id);
            if (budgetIds.length > 0) {
                const { data: itemsData, error: itemsError } = await supabase.from('budget_items').select('*').in('budget_id', budgetIds);
                if (itemsError) throw itemsError;

                const combinedBudgets: Budget[] = budgetsData.map(budget => ({
                    ...budget,
                    total_amount: parseFloat(budget.total_amount as any),
                    items: itemsData.filter(item => item.budget_id === budget.id).map(item => ({...item, unit_price: parseFloat(item.unit_price as any)}))
                }));
                setBudgets(combinedBudgets);
            } else {
                setBudgets([]);
            }
        } catch (err) {
            setError("Falha ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);
    
    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const channel = supabase.channel('budgets_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, (payload) => {
            fetchData();
        }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [supabase, fetchData]);
    
    const calculateTotal = (items: BudgetItem[]) => items.reduce((total, item) => total + (item.unit_price * item.quantity), 0);

    const resetAddForm = () => {
        setAddBudgetItems([]);
        setAddSelectedProductId("");
        setAddItemQuantity(1);
        setAddSelectedCustomerId(null);
        setAddValidUntil(thirtyDaysFromNow());
        setAddFormError(null);
        setProductSearch("");
    };

    const openAddDialog = () => {
        resetAddForm();
        setIsAddDialogOpen(true);
    };
    
    const handleAddItemToList = (
        list: BudgetItem[], 
        setList: React.Dispatch<React.SetStateAction<BudgetItem[]>>,
        productId: string,
        quantity: number,
        setProductId: (id: string) => void,
        setQuantity: (q: number) => void,
        setErrorFunc: (e: string | null) => void
    ) => {
        setErrorFunc(null);
        if (!productId) { setErrorFunc("Selecione um produto para adicionar."); return; }
        const product = products.find(p => p.id === productId);
        if (!product) { setErrorFunc("Produto não encontrado."); return; }
        const existingItem = list.find(item => item.product_id === product.id);
        if (existingItem) {
            setList(list.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + quantity } : item ));
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

    const handleCreateBudget = async () => {
        if (addBudgetItems.length === 0) { setAddFormError("Adicione pelo menos um produto ao orçamento."); return; }
        setLoading(true); setAddFormError(null);
        try {
            const selectedCustomer = customers.find(c => c.id === addSelectedCustomerId);
            const total_amount = calculateTotal(addBudgetItems);
            
            const { data: budgetData, error: budgetError } = await supabase.from('budgets').insert({ 
                total_amount,
                customer_id: selectedCustomer?.id || null,
                customer_name: selectedCustomer?.name || null,
                valid_until: addValidUntil,
                employee_name: currentUser?.email
            }).select().single();

            if (budgetError) throw budgetError;
            
            const itemsToInsert = addBudgetItems.map(item => ({ budget_id: budgetData.id, ...item }));
            const { error: itemsError } = await supabase.from('budget_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
            
            setIsAddDialogOpen(false);
            fetchData(); 
        } catch (err: any) {
            setAddFormError("Erro ao salvar o orçamento. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };
    
    const openEditDialog = (budget: Budget) => {
        setEditingBudget(budget);
        setEditSelectedCustomerId(budget.customer_id);
        setEditValidUntil(budget.valid_until || "");
        setEditBudgetItems(budget.items);
        setEditFormError(null);
        setEditSelectedProductId("");
        setEditItemQuantity(1);
        setProductSearch("");
        setIsEditDialogOpen(true);
    };

    const handleUpdateBudget = async () => {
        if (!editingBudget) return;
        if (editBudgetItems.length === 0) { setEditFormError("O orçamento deve ter pelo menos um item."); return; }
        setLoading(true); setEditFormError(null);
        try {
            const selectedCustomer = customers.find(c => c.id === editSelectedCustomerId);
            const total_amount = calculateTotal(editBudgetItems);

            const { error: budgetUpdateError } = await supabase.from('budgets').update({
                total_amount,
                customer_id: selectedCustomer?.id || null,
                customer_name: selectedCustomer?.name || null,
                valid_until: editValidUntil
            }).eq('id', editingBudget.id);
            if (budgetUpdateError) throw budgetUpdateError;

            await supabase.from('budget_items').delete().eq('budget_id', editingBudget.id);

            const itemsToInsert = editBudgetItems.map(item => ({
                budget_id: editingBudget.id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price
            }));
            
            const { error: insertItemsError } = await supabase.from('budget_items').insert(itemsToInsert);
            if (insertItemsError) throw insertItemsError;
            
            setIsEditDialogOpen(false);
            fetchData();
        } catch (err) {
            console.error("Erro detalhado ao atualizar:", err);
            setEditFormError("Erro ao atualizar o orçamento. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBudget = async (budgetId: number) => {
        if (!window.confirm("Tem certeza que deseja excluir este orçamento? Ele poderá ser recuperado no futuro.")) return;
        setLoading(true);
        try {
            await supabase
                .from('budgets')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', budgetId);
            
            setIsEditDialogOpen(false);
        } catch (err) {
            setEditFormError("Erro ao excluir o orçamento.");
        } finally {
            setLoading(false);
        }
    };

    const openDetailsDialog = (budget: Budget) => {
        setSelectedBudget(budget);
        setIsDetailsDialogOpen(true);
    };

    const filteredBudgets = budgets.filter(q => 
        (q.budget_code && q.budget_code.toLowerCase().includes(searchTerm.toLowerCase())) || 
        (q.customer_name && q.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
    
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');
    const formatDateWithTimezone = (dateString: string) => new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                <h1 className="text-white text-3xl font-bold">Orçamentos</h1>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input type="search" placeholder="Buscar orçamentos..." className="pl-10 w-full bg-[#1C1C1C] text-white border-zinc-600 placeholder:text-zinc-500 rounded-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer" onClick={openAddDialog}>
                        <Plus className="h-5 w-5" />
                        Adicionar Orçamento
                    </Button>
                </div>
            </div>
            <div className="space-y-2">
                <div className="hidden md:grid md:grid-cols-12 items-center gap-x-4 px-3 pb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="col-span-2 text-left">Código</div>
                    <div className="col-span-3 text-left">Cliente</div>
                    <div className="col-span-2 text-left">Data</div>
                    <div className="col-span-2 text-left">Funcionário</div>
                    <div className="col-span-1 text-center">Itens</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1 text-right">Ações</div>
                </div>

                {loading && <div className="text-center text-white py-8"><Loader2 className="h-10 w-10 animate-spin text-white mx-auto" /><p className="mt-3">Carregando...</p></div>}
                {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md">{error}</div>}
                
                {!loading && filteredBudgets.map(budget => (
                    <div 
                        key={budget.id} 
                        className="grid grid-cols-2 md:grid-cols-12 items-center gap-x-4 bg-[#1C1C1C] p-3 rounded-lg hover:bg-zinc-800 transition-colors duration-200 cursor-pointer"
                        onClick={() => openEditDialog(budget)}
                    >
                        <div className="md:col-span-2 text-left text-white font-medium truncate">{budget.budget_code}</div>
                        <div className="md:col-span-3 text-left text-zinc-300 truncate">{budget.customer_name || 'N/A'}</div>
                        <div className="md:col-span-2 text-left text-zinc-400 truncate">{formatDate(budget.created_at)}</div>
                        <div className="md:col-span-2 text-left text-zinc-400 truncate">{budget.employee_name || 'N/A'}</div>
                        <div className="md:col-span-1 text-center text-zinc-400 truncate">{budget.items.length}</div>
                        <div className="md:col-span-1 text-right text-white font-semibold truncate">{budget.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div className="md:col-span-1 flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="cursor-pointer hover:bg-zinc-700" onClick={() => openDetailsDialog(budget)}><Eye className="h-5 w-5 text-zinc-400" /></Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="cursor-pointer hover:bg-zinc-700"><MoreVertical className="h-5 w-5 text-zinc-400" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-zinc-800 text-white border-zinc-700">
                                    <DropdownMenuItem className="cursor-pointer focus:bg-zinc-700 focus:text-white" onSelect={() => handleSaveAsPdf(budget)}><FileDown className="mr-2 h-4 w-4"/>Salvar em PDF</DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer focus:bg-zinc-700 focus:text-white" onSelect={() => handlePrint(budget)}><Printer className="mr-2 h-4 w-4"/>Imprimir</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}
                {!loading && filteredBudgets.length === 0 && !error && (
                    <div className="text-center text-zinc-500 py-10">Nenhum orçamento encontrado.</div>
                )}
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader><DialogTitle>Adicionar Orçamento</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label className="block text-sm font-medium text-zinc-400 mb-1">Cliente (Opcional)</Label>
                                <Select value={addSelectedCustomerId || ""} onValueChange={setAddSelectedCustomerId}><SelectTrigger className="bg-zinc-800 border-zinc-700 cursor-pointer"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer">{customers.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>)}</SelectContent></Select>
                            </div>
                             <div>
                                <Label className="block text-sm font-medium text-zinc-400 mb-1">Válido até</Label>
                                <Input type="date" value={addValidUntil} min={todayDate()} onChange={(e) => setAddValidUntil(e.target.value)} className="w-full h-10 bg-zinc-800 border-zinc-700"/>
                            </div>
                        </div>

                        <Separator className="bg-zinc-700" />
                        
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Adicionar Itens</h3>
                            <div className="flex flex-wrap items-stretch gap-2">
                                <Select value={addSelectedProductId} onValueChange={setAddSelectedProductId}>
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
                                <Input type="number" value={addItemQuantity} onChange={(e) => setAddItemQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 h-10 text-center bg-zinc-800 border-zinc-700" />
                                <Button onClick={() => handleAddItemToList(addBudgetItems, setAddBudgetItems, addSelectedProductId, addItemQuantity, setAddSelectedProductId, setAddItemQuantity, setAddFormError)} className="h-10 bg-zinc-700 hover:bg-zinc-600 text-white cursor-pointer">Adicionar</Button>
                            </div>
                        </div>
                        <div className="flex-grow space-y-2 mt-4">
                            {addBudgetItems.length === 0 ? <p className="text-zinc-500 text-center py-4">Nenhum item adicionado.</p> : addBudgetItems.map(item => (
                                <div key={item.product_id} className="flex justify-between items-center text-sm p-3 bg-zinc-800 rounded">
                                    <div>
                                        <p>{item.quantity}x {item.product_name}</p>
                                        <p className="text-xs text-zinc-400">{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    </div>
                                    <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-900/20 cursor-pointer" onClick={() => handleRemoveItemFromList(addBudgetItems, setAddBudgetItems, item.product_id)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-zinc-700 text-right">
                            <p className="text-zinc-400">Valor Total</p>
                            <p className="text-2xl font-bold">{calculateTotal(addBudgetItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                    {addFormError && <p className="text-sm text-red-500 mt-2">{addFormError}</p>}
                    <DialogFooter className="mt-4">
                       <Button variant="ghost" className="hover:bg-zinc-700 cursor-pointer" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                       <Button variant="ghost" className="mr-2 cursor-pointer hover:bg-zinc-700" onClick={handleCreateBudget} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Salvar Orçamento"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader><DialogTitle>Editar Orçamento: {editingBudget?.budget_code}</DialogTitle></DialogHeader>
                    {editingBudget && (
                        <>
                            <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Label className="block text-sm font-medium text-zinc-400 mb-1">Cliente (Opcional)</Label>
                                        <Select value={editSelectedCustomerId || ""} onValueChange={setEditSelectedCustomerId}><SelectTrigger className="bg-zinc-800 border-zinc-700 cursor-pointer"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent className="bg-zinc-800 text-white border-zinc-700 cursor-pointer">{customers.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.name}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div>
                                        <Label className="block text-sm font-medium text-zinc-400 mb-1">Válido até</Label>
                                        <Input type="date" value={editValidUntil} min={todayDate()} onChange={(e) => setEditValidUntil(e.target.value)} className="w-full h-10 bg-zinc-800 border-zinc-700"/>
                                    </div>
                                </div>

                                <Separator className="bg-zinc-700" />
                                
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-white">Itens do Orçamento</h3>
                                    <div className="flex flex-wrap items-stretch gap-2">
                                        <Select value={editSelectedProductId} onValueChange={setEditSelectedProductId}>
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
                                                    {filteredProducts.map(p => (
                                                        <SelectItem key={p.id} value={p.id} disabled={p.quantity <= 0} className="cursor-pointer">
                                                            {p.name} ({p.quantity} disp.)
                                                        </SelectItem>
                                                    ))}
                                                </div>
                                            </SelectContent>
                                        </Select>
                                        <Input type="number" value={editItemQuantity} onChange={(e) => setEditItemQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 h-10 text-center bg-zinc-800 border-zinc-700" />
                                        <Button onClick={() => handleAddItemToList(editBudgetItems, setEditBudgetItems, editSelectedProductId, editItemQuantity, setEditSelectedProductId, setEditItemQuantity, setEditFormError)} className="h-10 bg-zinc-700 hover:bg-zinc-600 text-white cursor-pointer">Adicionar</Button>
                                    </div>
                                </div>
                                <div className="flex-grow space-y-2 mt-4">
                                    {editBudgetItems.length === 0 ? <p className="text-zinc-500 text-center py-4">Nenhum item adicionado.</p> : editBudgetItems.map(item => (
                                        <div key={item.product_id} className="flex justify-between items-center text-sm p-3 bg-zinc-800 rounded">
                                            <div>
                                                <p>{item.quantity}x {item.product_name}</p>
                                                <p className="text-xs text-zinc-400">{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                            </div>
                                            <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-900/20 cursor-pointer" onClick={() => handleRemoveItemFromList(editBudgetItems, setEditBudgetItems, item.product_id)}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-4 border-t border-zinc-700 text-right">
                                    <p className="text-zinc-400">Valor Total</p>
                                    <p className="text-2xl font-bold">{calculateTotal(editBudgetItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                            </div>
                            {editFormError && <p className="text-sm text-red-500 mt-2">{editFormError}</p>}
                            <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-between w-full">
                                <Button variant="ghost" className="text-red-500 hover:bg-red-900/20 hover:text-red-400 justify-start sm:justify-center cursor-pointer" onClick={() => handleDeleteBudget(editingBudget.id)} disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" /> : <><Trash2 className="mr-2 h-4 w-4" />Excluir Orçamento</>}
                                </Button>
                                <div>
                                    <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="hover:bg-zinc-700 cursor-pointer">Cancelar</Button>
                                    <Button variant="ghost" className="mr-2 cursor-pointer hover:bg-zinc-700" onClick={handleUpdateBudget} disabled={loading}>
                                        {loading ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}
                                    </Button>
                                </div>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

             <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-2xl bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Orçamento: {selectedBudget?.budget_code}</DialogTitle>
                        <p className="text-sm text-zinc-400">Cliente: {selectedBudget?.customer_name || "Não informado"}</p>
                        <p className="text-sm text-zinc-400">Criado por: {selectedBudget?.employee_name || 'N/A'}</p>
                        {selectedBudget?.valid_until && <p className="text-sm text-yellow-400">Válido até: {formatDateWithTimezone(selectedBudget.valid_until)}</p>}
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto space-y-4 py-4 pr-3">
                        {selectedBudget?.items.map(item => (
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
                        <span>{selectedBudget?.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <DialogFooter className="sm:justify-end mt-4">
                        <Button variant="outline" className="bg-transparent border-zinc-700 hover:bg-zinc-800 hover:text-white cursor-pointer" onClick={() => setIsDetailsDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}