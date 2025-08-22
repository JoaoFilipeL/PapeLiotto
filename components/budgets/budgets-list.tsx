"use client"
import React, { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Minus, Trash2, Loader2, Eye, MoreVertical, FileDown, Printer } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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

const getBudgetHtml = (budget: Budget): string => {
    const itemsHtml = budget.items.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px;">${item.product_name}</td>
            <td style="padding: 8px; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; text-align: right;">${item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style="padding: 8px; text-align: right;">${(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        </tr>
    `).join('');

    return `
        <html>
            <head>
                <title>Orçamento ${budget.budget_code}</title>
                <style>
                    body { font-family: sans-serif; color: #000; background-color: #fff; }
                    table { width: 100%; border-collapse: collapse; }
                    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid #ccc; }
                    .header h1 { font-size: 24px; font-weight: bold; margin: 0; }
                    .header .details { text-align: right; }
                    .header .details p { margin: 0; }
                    .total-section { display: flex; justify-content: flex-end; margin-top: 32px; }
                    .total-box { width: 40%; display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; padding: 8px; background-color: #F3F4F6; border-radius: 4px; }
                </style>
            </head>
            <body>
                <div style="padding: 32px; width: 210mm; margin: auto;">
                    <div class="header">
                        <h1>Orçamento</h1>
                        <div class="details">
                            <p style="font-family: monospace; font-size: 18px;">${budget.budget_code}</p>
                            <p style="font-size: 14px;">Data: ${new Date(budget.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                    <div style="margin-bottom: 24px;">
                        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Itens:</h2>
                        <table>
                            <thead>
                                <tr style="border-bottom: 1px solid #ddd;">
                                    <th style="padding: 8px; text-align: left;">Produto</th>
                                    <th style="padding: 8px; text-align: center;">Qtd.</th>
                                    <th style="padding: 8px; text-align: right;">Preço Unit.</th>
                                    <th style="padding: 8px; text-align: right;">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>
                    </div>
                    <div class="total-section">
                        <div class="total-box">
                            <span>Total:</span>
                            <span>${budget.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `;
};

export function BudgetsList() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [addBudgetItems, setAddBudgetItems] = useState<BudgetItem[]>([]);
    const [addSelectedProductId, setAddSelectedProductId] = useState<string>("");
    const [addItemQuantity, setAddItemQuantity] = useState(1);
    const [nextBudgetCode, setNextBudgetCode] = useState("");
    const [addFormError, setAddFormError] = useState<string | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    
    const supabase = createClientComponentClient();

    const handlePrint = (budget: Budget) => {
        const htmlContent = getBudgetHtml(budget);
        const printWindow = window.open('', '', 'height=800,width=800');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }
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
                    html2canvas(elementToCapture, { scale: 2, useCORS: true }).then(canvas => {
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                        pdf.save(`orcamento-${budget.budget_code}.pdf`);
                        printWindow.close();
                    });
                } else {
                    printWindow.close();
                }
            }, 500);
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: productsData, error: productsError } = await supabase.from('stock').select('*').order('name');
            if (productsError) throw productsError;
            setProducts(productsData.map(p => ({ ...p, price: parseFloat(p.price as any) })));
            const { data: budgetsData, error: budgetsError } = await supabase.from('budgets').select('*').order('created_at', { ascending: false });
            if (budgetsError) throw budgetsError;
            const budgetIds = budgetsData.map(q => q.id);
            const { data: itemsData, error: itemsError } = await supabase.from('budget_items').select('*').in('budget_id', budgetIds);
            if (itemsError) throw itemsError;
            const combinedBudgets: Budget[] = budgetsData.map(budget => ({
                ...budget,
                total_amount: parseFloat(budget.total_amount as any),
                items: itemsData.filter(item => item.budget_id === budget.id).map(item => ({...item, unit_price: parseFloat(item.unit_price as any)}))
            }));
            setBudgets(combinedBudgets);
            const lastId = budgetsData.length > 0 ? Math.max(...budgetsData.map(q => parseInt(q.budget_code.split('-')[1]))) : 0;
            setNextBudgetCode(`ORC-${(lastId + 1).toString().padStart(4, '0')}`);
        } catch (err) {
            setError("Falha ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchData();
        const channel = supabase.channel('budgets_realtime').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [supabase, fetchData]);
    
    const calculateTotal = (items: BudgetItem[]) => items.reduce((total, item) => total + (item.unit_price * item.quantity), 0);

    const resetAddForm = () => {
        setAddBudgetItems([]);
        setAddSelectedProductId("");
        setAddItemQuantity(1);
        setAddFormError(null);
    };
    
    const handleAddItemToList = () => {
        setAddFormError(null);
        if (!addSelectedProductId) {
            setAddFormError("Selecione um produto para adicionar.");
            return;
        }
        const product = products.find(p => p.id === addSelectedProductId);
        if (!product) {
            setAddFormError("Produto não encontrado.");
            return;
        }
        const existingItem = addBudgetItems.find(item => item.product_id === product.id);
        if (existingItem) {
            setAddBudgetItems(addBudgetItems.map(item => 
                item.product_id === product.id ? { ...item, quantity: item.quantity + addItemQuantity } : item
            ));
        } else {
            setAddBudgetItems([...addBudgetItems, {
                product_id: product.id,
                product_name: product.name,
                quantity: addItemQuantity,
                unit_price: product.price
            }]);
        }
        setAddSelectedProductId("");
        setAddItemQuantity(1);
    };

    const handleRemoveItemFromList = (productId: string) => {
        setAddBudgetItems(addBudgetItems.filter(item => item.product_id !== productId));
    };

    const handleCreateBudget = async () => {
        if (addBudgetItems.length === 0) {
            setAddFormError("Adicione pelo menos um produto ao orçamento.");
            return;
        }
        setLoading(true);
        setAddFormError(null);
        try {
            const total_amount = calculateTotal(addBudgetItems);
            const { data: budgetData, error: budgetError } = await supabase.from('budgets').insert({ budget_code: nextBudgetCode, total_amount }).select().single();
            if (budgetError) throw budgetError;
            const itemsToInsert = addBudgetItems.map(item => ({ budget_id: budgetData.id, ...item }));
            const { error: itemsError } = await supabase.from('budget_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
            setIsAddDialogOpen(false);
        } catch (err: any) {
            setAddFormError("Erro ao salvar o orçamento. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };
    
    const openDetailsDialog = (budget: Budget) => {
        setSelectedBudget(budget);
        setIsDetailsDialogOpen(true);
    };

    const filteredBudgets = budgets.filter(q => q.budget_code.toLowerCase().includes(searchTerm.toLowerCase()));
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                <h1 className="text-white text-3xl font-bold">Orçamentos</h1>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input type="search" placeholder="Buscar orçamentos..." className="pl-10 w-full bg-[#1C1C1C] text-white border-zinc-600 placeholder:text-zinc-500 rounded-lg" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-5 w-5" />
                        Adicionar Orçamento
                    </Button>
                </div>
            </div>
            {!loading && !error && filteredBudgets.length > 0 && (
                <div className="hidden md:flex items-center px-3 pb-2 mb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="flex-1 text-left pr-4">Código</div>
                    <div className="flex-1 text-left pr-4">Data</div>
                    <div className="w-20 text-left pr-4">Itens</div>
                    <div className="flex-1 text-right pr-4">Total</div>
                    <div className="w-20 text-right">Ações</div>
                </div>
            )}
            <div className="space-y-2">
                {loading && <div className="text-center text-white py-8"><Loader2 className="h-10 w-10 animate-spin text-white mx-auto" /><p className="mt-3">Carregando...</p></div>}
                {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md">{error}</div>}
                {!loading && filteredBudgets.map(budget => (
                    <div key={budget.id} className="grid grid-cols-2 md:flex items-center bg-[#1C1C1C] p-3 rounded-lg hover:bg-zinc-800 transition-colors duration-200">
                        <div className="md:flex-1 text-left pr-4 text-white font-medium truncate"><span className="md:hidden font-semibold text-zinc-400">Código: </span>{budget.budget_code}</div>
                        <div className="md:flex-1 text-left md:text-left pr-4 text-zinc-400 truncate text-right"><span className="md:hidden font-semibold">Data: </span>{formatDate(budget.created_at)}</div>
                        <div className="md:w-20 text-left pr-4 text-zinc-400 truncate"><span className="md:hidden font-semibold">Itens: </span>{budget.items.length}</div>
                        <div className="md:flex-1 text-right pr-4 text-white font-semibold truncate col-span-2 mt-2 md:mt-0"><span className="md:hidden font-semibold text-zinc-400">Total: </span>{budget.total_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                        <div className="md:w-20 flex justify-end items-center col-span-2 mt-2 md:mt-0">
                            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => openDetailsDialog(budget)}><Eye className="h-5 w-5 text-zinc-400" /></Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="cursor-pointer"><MoreVertical className="h-5 w-5 text-zinc-400" /></Button>
                                </DropdownMenuTrigger>
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
            <Dialog open={isAddDialogOpen} onOpenChange={(isOpen) => { setIsAddDialogOpen(isOpen); if (!isOpen) resetAddForm(); }}>
                <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader><DialogTitle>Adicionar Orçamento: {nextBudgetCode}</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Adicionar Itens</h3>
                            <div className="flex flex-wrap items-stretch gap-2">
                                <Select value={addSelectedProductId} onValueChange={setAddSelectedProductId}>
                                    <SelectTrigger className="bg-zinc-800 border-zinc-700 flex-1 min-w-[200px] h-10"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                                    <SelectContent>{products.map(p => (<SelectItem key={p.id} value={p.id} disabled={p.quantity <= 0}>{p.name} ({p.quantity} disp.)</SelectItem>))}</SelectContent>
                                </Select>
                                <div className="flex items-center gap-1">
                                    <Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800 cursor-pointer" onClick={() => setAddItemQuantity(prev => Math.max(1, prev - 1))}><Minus className="h-4 w-4"/></Button>
                                    <Input type="number" value={addItemQuantity} onChange={(e) => setAddItemQuantity(parseInt(e.target.value) || 1)} className="w-16 h-10 text-center bg-zinc-800 border-zinc-700"/>
                                    <Button size="icon" variant="outline" className="h-10 w-10 bg-zinc-800 cursor-pointer" onClick={() => setAddItemQuantity(prev => prev + 1)}><Plus className="h-4 w-4"/></Button>
                                </div>
                                <Button onClick={handleAddItemToList} className="h-10 bg-zinc-700 hover:bg-zinc-600 text-white cursor-pointer">Adicionar</Button>
                            </div>
                        </div>
                        <Separator className="bg-zinc-700" />
                        <div className="flex-grow space-y-2 mt-4">
                            {addBudgetItems.length === 0 ? <p className="text-zinc-500 text-center py-4">Nenhum item adicionado ao orçamento.</p> : addBudgetItems.map(item => (
                                <div key={item.product_id} className="flex justify-between items-center text-sm p-3 bg-zinc-800 rounded">
                                    <div>
                                        <p>{item.quantity}x {item.product_name}</p>
                                        <p className="text-xs text-zinc-400">{(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    </div>
                                    <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-900/20 cursor-pointer" onClick={() => handleRemoveItemFromList(item.product_id)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-zinc-700 text-right">
                            <p className="text-zinc-400">Valor Total</p>
                            <p className="text-2xl font-bold">{calculateTotal(addBudgetItems).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                    </div>
                    {addFormError && <p className="text-sm text-red-500 mt-2">{addFormError}</p>}
                    <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                       <Button variant="outline" className="bg-transparent border-zinc-700 hover:bg-zinc-800 hover:text-white cursor-pointer" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                       <Button className="bg-white text-black hover:bg-gray-300 cursor-pointer" onClick={handleCreateBudget} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Salvar Orçamento"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-2xl bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Orçamento: {selectedBudget?.budget_code}</DialogTitle>
                        <p className="text-sm text-zinc-400">Criado em: {selectedBudget && formatDate(selectedBudget.created_at)}</p>
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
                        <Button variant="outline" className="bg-transparent border-zinc-700 hover:bg-zinc-800 hover:text-white" onClick={() => setIsDetailsDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}