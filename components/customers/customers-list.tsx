"use client"
import type React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Loader2, Trash2, User, ArrowLeft } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Customer {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
}

const initialFormState = {
    name: "",
    phone: "",
    address: "",
};

export function CustomersList() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formState, setFormState] = useState(initialFormState);
    const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

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

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormState(prev => ({ ...prev, [id]: value }));
    };

    const handleSaveCustomer = async () => {
        if (!formState.name) {
            setFormError("O nome do cliente é obrigatório.");
            return;
        }
        setLoading(true);
        setFormError(null);

        try {
            if (isEditing && editingCustomerId) {
                const { error } = await supabase
                    .from('customers')
                    .update({
                        name: formState.name,
                        phone: formState.phone || null,
                        address: formState.address || null
                    })
                    .eq('id', editingCustomerId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert({
                        name: formState.name,
                        phone: formState.phone || null,
                        address: formState.address || null
                    });
                if (error) throw error;
            }
            closeForm();
        } catch (err) {
            if (err instanceof Error) setFormError(`Erro ao salvar cliente: ${err.message}`);
            else setFormError("Ocorreu um erro desconhecido ao salvar o cliente.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCustomer = async () => {
        if (!editingCustomerId) return;
        if (window.confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.")) {
            setLoading(true);
            try {
                const { error } = await supabase.from('customers').delete().eq('id', editingCustomerId);
                if (error) throw error;
                closeForm();
            } catch (err) {
                 if (err instanceof Error) setFormError(`Erro ao excluir cliente: ${err.message}`);
                 else setFormError("Ocorreu um erro desconhecido ao excluir o cliente.");
            } finally {
                setLoading(false);
            }
        }
    };
    
    const openAddForm = () => {
        setIsEditing(false);
        setFormState(initialFormState);
        setEditingCustomerId(null);
        setFormError(null);
        setIsFormOpen(true);
    };

    const openEditForm = (customer: Customer) => {
        setIsEditing(true);
        setFormState({
            name: customer.name,
            phone: customer.phone || "",
            address: customer.address || ""
        });
        setEditingCustomerId(customer.id);
        setFormError(null);
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setTimeout(() => {
            setFormState(initialFormState);
            setEditingCustomerId(null);
            setIsEditing(false);
            setFormError(null);
        }, 300);
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

            <div className="space-y-2">
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

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Editar Cliente" : "Adicionar Novo Cliente"}</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {isEditing ? "Altere os dados do cliente abaixo." : "Preencha os dados do novo cliente."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input id="name" value={formState.name} onChange={handleFormChange} className="bg-zinc-800 border-zinc-700"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input id="phone" value={formState.phone ?? ''} onChange={handleFormChange} className="bg-zinc-800 border-zinc-700"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Endereço</Label>
                            <Input id="address" value={formState.address ?? ''} onChange={handleFormChange} className="bg-zinc-800 border-zinc-700"/>
                        </div>
                    </div>
                    {formError && <p className="text-sm text-red-500 mt-2">{formError}</p>}
                    <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-between w-full">
                        {isEditing ? (
                             <Button variant="ghost" className="text-red-500 hover:bg-red-900/20 hover:text-red-400 justify-center sm:justify-start cursor-pointer" onClick={handleDeleteCustomer} disabled={loading}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir Cliente
                            </Button>
                        ) : (
                            <div></div>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <Button className="cursor-pointer hover:bg-zinc-600" onClick={closeForm}>Cancelar</Button>
                            <Button className="cursor-pointer hover:bg-zinc-600" onClick={handleSaveCustomer} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Salvar"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}