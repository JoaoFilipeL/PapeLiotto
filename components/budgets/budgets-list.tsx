"use client"
import React, { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Loader2, Eye, MoreVertical, FileDown, Printer } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Product } from "../stock/types/stock"
import { Customer, Budget, CurrentUser, BudgetItem } from "../orders/types/orders"
import { handlePrint, handleSaveAsPdf } from "./budget-print-utils"
import { BudgetFormDialog, BudgetDetailsDialog } from "./budget-modals"
import { toast } from "sonner"

export function BudgetsList() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    
    const supabase = createClientComponentClient();

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        fetchUser();
    }, [supabase]);
    
    const fetchData = useCallback(async () => {
        setError(null);
        try {
            const { data: productsData, error: productsError } = await supabase.from('stock').select('id, name, price, quantity').order('name');
            if (productsError) throw productsError;
            setProducts(productsData.map(p => ({ ...p, price: parseFloat(p.price as any) })));

            const { data: customersData, error: customersError } = await supabase.from('customers').select('id, name, phone, address').order('name');
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
            toast.error("Falha ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);
    
    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const channel = supabase.channel('budgets_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, (payload) => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_items' }, (payload) => {
                fetchData();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [supabase, fetchData]);
    
    const openAddDialog = () => {
        setIsEditing(false);
        setSelectedBudget(null);
        setIsFormOpen(true);
    };
    
    const openEditDialog = (budget: Budget) => {
        setIsEditing(true);
        setSelectedBudget(budget);
        setIsFormOpen(true);
    };

    const openDetailsDialog = (budget: Budget) => {
        setSelectedBudget(budget);
        setIsDetailsOpen(true);
    };

    const filteredBudgets = budgets.filter(q => 
        (q.budget_code && q.budget_code.toLowerCase().includes(searchTerm.toLowerCase())) || 
        (q.customer_name && q.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
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
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer" onClick={openAddDialog}>
                        <Plus className="h-5 w-5" />
                        Adicionar Orçamento
                    </Button>
                </div>
            </div>
            
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
                
            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-2">
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
            
            <BudgetFormDialog
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                customers={customers}
                products={products}
                currentUser={currentUser}
                editingBudget={isEditing ? selectedBudget : null}
                onBudgetSaved={fetchData}
            />

             <BudgetDetailsDialog
                isOpen={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                budget={selectedBudget}
            />
        </div>
    );
}