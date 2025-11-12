"use client"
import type React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Loader2, User, ArrowLeft } from "lucide-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Customer } from "../orders/types/orders" 
import { CustomerFormModal } from "./customer-form-modal"
import { toast } from "sonner"

export function CustomersList() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    const supabase = createClientComponentClient();

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true });
            if (error) throw error;
            setCustomers(data);
        } catch (err) {
            setError("Falha ao carregar clientes.");
            toast.error("Falha ao carregar clientes.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchCustomers();
        const channel = supabase.channel('customers_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchCustomers).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [supabase, fetchCustomers]);

    const openAddForm = () => {
        setIsEditing(false);
        setEditingCustomer(null);
        setIsFormOpen(true);
    };

    const openEditForm = (customer: Customer) => {
        setIsEditing(true);
        setEditingCustomer(customer);
        setIsFormOpen(true);
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                 <div className="flex items-center gap-4">
                    <Link href="/orders" passHref>
                        <Button variant="outline" size="icon" className="bg-[#1C1C1C] border-zinc-700 text-white hover:bg-zinc-700 cursor-pointer">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-white text-3xl font-bold">Clientes</h1>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input
                            type="search"
                            placeholder="Buscar clientes..."
                            className="pl-10 w-full bg-[#1C1C1C] text-white border-zinc-600 placeholder:text-zinc-500 rounded-lg"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer" onClick={openAddForm}>
                        <Plus className="h-5 w-5" />
                        Adicionar Cliente
                    </Button>
                </div>
            </div>
            
            {!loading && filteredCustomers.length > 0 && (
                <div className="hidden md:flex items-center px-4 pb-2 mb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="flex-1 text-left pr-4">Nome</div>
                    <div className="flex-1 text-left pr-4">Telefone</div>
                    <div className="flex-1 text-left pr-4">Endereço</div>
                </div>
            )}

            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-2">
                {loading && <div className="text-center text-zinc-400 py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>}
                {error && <p className="text-center text-red-500 bg-red-900/20 p-3 rounded-md">{error}</p>}
                
                {!loading && filteredCustomers.map(customer => (
                    <div key={customer.id} className="grid grid-cols-1 md:flex items-center bg-[#1C1C1C] p-4 rounded-lg hover:bg-zinc-800 transition-colors duration-200 cursor-pointer" onClick={() => openEditForm(customer)}>
                        <div className="md:flex-1 flex items-center pr-4">
                            <User className="h-5 w-5 mr-3 text-zinc-400 flex-shrink-0"/>
                            <span className="text-white font-medium truncate">{customer.name}</span>
                        </div>
                        <div className="md:flex-1 text-zinc-300 truncate pr-4 mt-2 md:mt-0"><span className="md:hidden font-semibold text-zinc-400">Telefone: </span>{customer.phone || 'Não informado'}</div>
                        <div className="md:flex-1 text-zinc-300 truncate pr-4 mt-2 md:mt-0"><span className="md:hidden font-semibold text-zinc-400">Endereço: </span>{customer.address || 'Não informado'}</div>
                    </div>
                ))}

                 {!loading && filteredCustomers.length === 0 && !error && (
                    <div className="text-center text-zinc-500 py-10">Nenhum cliente encontrado.</div>
                )}
            </div>

            <CustomerFormModal
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                isEditing={isEditing}
                customer={editingCustomer}
            />
        </div>
    );
}