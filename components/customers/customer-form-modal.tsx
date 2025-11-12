"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, Trash2 } from "lucide-react"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Customer } from "../orders/types/orders" 
import { toast } from "sonner"

const initialFormState = {
    name: "",
    phone: "",
    address: "",
};

interface CustomerFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    isEditing: boolean;
    customer: Customer | null;
}

export function CustomerFormModal({ isOpen, onOpenChange, isEditing, customer }: CustomerFormModalProps) {
    const [formState, setFormState] = useState(initialFormState);
    const [formError, setFormError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClientComponentClient();

    useEffect(() => {
        if (isOpen) {
            if (isEditing && customer) {
                setFormState({
                    name: customer.name,
                    phone: customer.phone || "",
                    address: customer.address || ""
                });
            } else {
                setFormState(initialFormState);
            }
            setFormError(null);
            setIsLoading(false);
        }
    }, [isOpen, isEditing, customer]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormState(prev => ({ ...prev, [id]: value }));
    };

    const handleSaveCustomer = async () => {
        if (!formState.name) {
            setFormError("O nome do cliente é obrigatório.");
            return;
        }
        setIsLoading(true);
        setFormError(null);

        try {
            if (isEditing && customer) {
                const { error } = await supabase
                    .from('customers')
                    .update({
                        name: formState.name,
                        phone: formState.phone || null,
                        address: formState.address || null
                    })
                    .eq('id', customer.id);
                if (error) throw error;
                toast.success("Cliente atualizado com sucesso!");
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert({
                        name: formState.name,
                        phone: formState.phone || null,
                        address: formState.address || null
                    });
                if (error) throw error;
                toast.success("Cliente adicionado com sucesso!");
            }
            onOpenChange(false);
        } catch (err) {
            const errorMsg = (err instanceof Error) ? err.message : "Ocorreu um erro desconhecido.";
            setFormError(`Erro ao salvar cliente: ${errorMsg}`);
            toast.error("Erro ao salvar cliente.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteCustomer = async () => {
        if (!isEditing || !customer) return;
        if (window.confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.")) {
            setIsLoading(true);
            try {
                const { error } = await supabase.from('customers').delete().eq('id', customer.id);
                if (error) throw error;
                toast.success("Cliente excluído com sucesso!");
                onOpenChange(false);
            } catch (err) {
                 const errorMsg = (err instanceof Error) ? err.message : "Ocorreu um erro desconhecido.";
                 setFormError(`Erro ao excluir cliente: ${errorMsg}`);
                 toast.error("Erro ao excluir cliente.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                         <Button variant="ghost" className="text-red-500 hover:bg-red-900/20 hover:text-red-400 justify-center sm:justify-start cursor-pointer" onClick={handleDeleteCustomer} disabled={isLoading}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Cliente
                        </Button>
                    ) : (
                        <div></div>
                    )}
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button variant="ghost" className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button variant="ghost" className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={handleSaveCustomer} disabled={isLoading}>
                            {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Salvar"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}