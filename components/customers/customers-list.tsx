"use client"
import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Loader2, Edit, Trash2, User } from "lucide-react"
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
        } catch (err: any) {
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
        } catch (err: any) {
            setFormError(`Erro ao salvar cliente: ${err.message}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCustomer = async (customerId: string) => {
        if (window.confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.")) {
            try {
                const { error } = await supabase.from('customers').delete().eq('id', customerId);
                if (error) throw error;
            } catch (err: any) {
                setError(`Erro ao excluir cliente: ${err.message}`);
                console.error(err);
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
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-white">Clientes</h1>
                <div className="flex items-center gap-4">
                     <Input
                        type="search"
                        placeholder="Buscar clientes..."
                        className="pl-10 w-full bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Button className="bg-white text-black hover:bg-gray-200" onClick={openAddForm}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Cliente
                    </Button>
                </div>
            </div>
            <div className="space-y-2">
                {loading && <p className="text-center text-zinc-400">Carregando...</p>}
                {error && <p className="text-center text-red-500">{error}</p>}
                {!loading && filteredCustomers.map(customer => (
                    <div key={customer.id} className="grid grid-cols-4 gap-4 items-center bg-zinc-800 p-4 rounded-lg">
                        <div className="col-span-1 flex items-center">
                            <User className="h-5 w-5 mr-3 text-zinc-400"/>
                            <span className="text-white font-medium truncate">{customer.name}</span>
                        </div>
                        <span className="col-span-1 text-zinc-300 truncate">{customer.phone || 'Não informado'}</span>
                        <span className="col-span-1 text-zinc-300 truncate">{customer.address || 'Não informado'}</span>
                        <div className="col-span-1 flex justify-end gap-2">
                           <Button variant="ghost" size="icon" onClick={() => openEditForm(customer)}>
                                <Edit className="h-5 w-5 text-zinc-400 hover:text-white"/>
                           </Button>
                           <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomer(customer.id)}>
                                <Trash2 className="h-5 w-5 text-red-500 hover:text-red-400"/>
                           </Button>
                        </div>
                    </div>
                ))}
            </div>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Editar Cliente" : "Adicionar Novo Cliente"}</DialogTitle>
                        <DialogDescription>
                            {isEditing ? "Altere os dados do cliente abaixo." : "Preencha os dados do novo cliente."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome*</Label>
                            <Input id="name" value={formState.name} onChange={handleFormChange} className="bg-zinc-800 border-zinc-700"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input id="phone" value={formState.phone} onChange={handleFormChange} className="bg-zinc-800 border-zinc-700"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Endereço</Label>
                            <Input id="address" value={formState.address} onChange={handleFormChange} className="bg-zinc-800 border-zinc-700"/>
                        </div>
                    </div>
                    {formError && <p className="text-sm text-red-500">{formError}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={closeForm}>Cancelar</Button>
                        <Button onClick={handleSaveCustomer} disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
