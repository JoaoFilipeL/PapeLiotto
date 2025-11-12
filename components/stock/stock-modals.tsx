'use client'
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Archive, Loader2, Trash2 } from "lucide-react"
import { StockProductForm } from "./stock-product-form"
import { StockItem, UserProfile, CurrentUser } from "./types/stock";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { toast } from "sonner";

const initialNewItemState = {
    name: "",
    barcode: "",
    supplier: "",
    quantity: "",
    unit: "un",
    minQuantity: "",
    price: "",
}

interface AddStockProductDialogProps {
    logStockChange: (details: any) => Promise<void>;
    currentUser: CurrentUser | null;
}

export function AddStockProductDialog({ logStockChange, currentUser }: AddStockProductDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newItem, setNewItem] = useState(initialNewItemState);
    const [formError, setFormError] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    const handleNewItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setNewItem(prev => ({ ...prev, [id]: id === 'barcode' ? value.replace(/\D/g, '').substring(0, 13) : value }));
    };

    const addNewItem = async () => {
        const { name, barcode, supplier, quantity, unit, minQuantity, price } = newItem;
        const parsedQuantity = Number.parseFloat(quantity);
        const parsedMinQuantity = Number.parseFloat(minQuantity);
        const parsedPrice = Number.parseFloat(price);

        if (!name || !barcode || !supplier || isNaN(parsedQuantity) || isNaN(parsedMinQuantity) || isNaN(parsedPrice) || parsedQuantity < 0 || parsedMinQuantity < 0 || parsedPrice < 0) {
            setFormError("Por favor, preencha todos os campos corretamente e com valores válidos.");
            return;
        }
        
        setIsSubmitting(true);
        setFormError(null);

        try {
            const { data, error } = await supabase.from('stock').insert([{ name, barcode, supplier, quantity: parsedQuantity, unit, min_quantity: parsedMinQuantity, price: parsedPrice, }]).select().single();
            if (error) throw error;
            
            await logStockChange({
                product_id: data.id,
                product_name: name,
                action: 'Produto Adicionado',
                quantity_change: parsedQuantity,
                old_quantity: 0,
                new_quantity: parsedQuantity
            });

            setNewItem(initialNewItemState);
            setIsOpen(false);
            toast.success("Produto adicionado com sucesso!");
        } catch (err: any) {
            console.error("Erro inesperado ao adicionar item:", err);
            setFormError(err.message);
            toast.error("Erro ao adicionar produto.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer">
                    <Archive className="h-5 w-5" />
                    Adicionar Produto
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                <DialogHeader><DialogTitle>Adicionar Novo Produto</DialogTitle><DialogDescription className="text-zinc-400">Preencha os detalhes do novo produto.</DialogDescription></DialogHeader>
                <StockProductForm
                    formState={newItem}
                    handleInputChange={handleNewItemChange}
                    formError={formError}
                    isEdit={false}
                />
                <DialogFooter className="mt-4">
                    <Button variant="ghost" className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                    <Button variant="ghost" className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={addNewItem} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Adicionar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface EditStockProductDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    product: StockItem | null;
    logStockChange: (details: any) => Promise<void>;
    userProfile: UserProfile | null;
}

export function EditStockProductDialog({ isOpen, onOpenChange, product, logStockChange, userProfile }: EditStockProductDialogProps) {
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editForm, setEditForm] = useState({
        name: "",
        barcode: "",
        supplier: "",
        quantity: "",
        unit: "",
        minQuantity: "",
        price: ""
    });
    const supabase = createClientComponentClient();

    useEffect(() => {
        if (product && isOpen) {
            setEditForm({
                name: product.name,
                barcode: product.barcode,
                supplier: product.supplier,
                quantity: product.quantity.toString(),
                unit: product.unit,
                minQuantity: product.minQuantity.toString(),
                price: product.price.toFixed(2),
            });
            setFormError(null);
            setIsSubmitting(false);
            setIsDeleting(false);
        }
    }, [product, isOpen]);

    const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setEditForm(prev => ({ ...prev, [id]: id === 'barcode' ? value.replace(/\D/g, '').substring(0, 13) : value }));
    };

    const updateProduct = async () => {
        if (!product) return;
        const { name, barcode, supplier, quantity, unit, minQuantity, price } = editForm;
        const parsedQuantity = Number.parseFloat(quantity);
        const parsedMinQuantity = Number.parseFloat(minQuantity);
        const parsedPrice = Number.parseFloat(price);
        if (!name || !barcode || !supplier || isNaN(parsedQuantity) || isNaN(parsedMinQuantity) || isNaN(parsedPrice) || parsedQuantity < 0 || parsedMinQuantity < 0 || parsedPrice < 0) {
            setFormError("Por favor, preencha todos os campos corretamente e com valores válidos."); return;
        }

        setIsSubmitting(true);
        setFormError(null);

        const changes: string[] = [];
        if (product.name !== name) changes.push(`Nome: '${product.name}' -> '${name}'`);
        if (product.barcode !== barcode) changes.push('Código de Barras alterado');
        if (product.supplier !== supplier) changes.push(`Fornecedor: '${product.supplier}' -> '${supplier}'`);
        if (product.price !== parsedPrice) changes.push(`Preço: R$${product.price.toFixed(2)} -> R$${parsedPrice.toFixed(2)}`);
        if (product.minQuantity !== parsedMinQuantity) changes.push(`Qtd. Mínima: ${product.minQuantity} -> ${parsedMinQuantity}`);
        
        const quantityChange = parsedQuantity - product.quantity;

        try {
            const { error } = await supabase.from('stock').update({ name, barcode, supplier, quantity: parsedQuantity, unit, min_quantity: parsedMinQuantity, price: parsedPrice, }).eq('id', product.id);
            if (error) throw error;
            
            if (changes.length > 0 || quantityChange !== 0) {
                await logStockChange({
                    product_id: product.id,
                    product_name: name,
                    action: 'Produto Editado',
                    details: changes.length > 0 ? changes.join('; ') : 'Apenas a quantidade foi alterada.',
                    quantity_change: quantityChange,
                    old_quantity: product.quantity,
                    new_quantity: parsedQuantity
                });
            }
            
            toast.success("Produto atualizado com sucesso!");
            onOpenChange(false);
        } catch (err: any) { 
            setFormError(err.message); 
            toast.error("Erro ao atualizar produto.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteProduct = async () => {
        if (!product) return;
        if (!window.confirm("Tem certeza que deseja 'desabilitar' este produto? Ele sairá da lista de estoque, mas o histórico será mantido.")) { return; }
        
        setIsDeleting(true);
        setFormError(null);
        try {
            const { error } = await supabase
                .from('stock')
                .update({ is_archived: true }) 
                .eq('id', product.id);

            if (error) throw error;
            
            toast.success("Produto desabilitado com sucesso.");
            onOpenChange(false);
        } catch (err: any) { 
            setFormError(err.message); 
            toast.error("Erro ao desabilitar produto.");
        } finally { 
            setIsDeleting(false); 
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                <DialogHeader><DialogTitle>Editar Produto: {product?.name}</DialogTitle><DialogDescription className="text-zinc-400">Edite os detalhes do produto.</DialogDescription></DialogHeader>
                <StockProductForm 
                    formState={editForm}
                    handleInputChange={handleEditFormChange}
                    formError={formError}
                    isEdit={true}
                />
                <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-between w-full">
                    {userProfile?.role === 'Gerente' && (
                        <Button 
                            variant="ghost" 
                            onClick={handleDeleteProduct} 
                            className="w-full sm:w-auto justify-center text-red-600 hover:bg-red-900/20 hover:text-red-500 cursor-pointer" 
                            disabled={isSubmitting || isDeleting}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Desabilitar Produto
                        </Button>
                    )}
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="ghost" className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={() => onOpenChange(false)} disabled={isSubmitting || isDeleting}>Cancelar</Button>
                        <Button variant="ghost" className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={updateProduct} disabled={isSubmitting || isDeleting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alterações"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface StockQuantityDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    productInfo: { product: StockItem; type: 'add' | 'subtract' } | null;
    logStockChange: (details: any) => Promise<void>;
}

export function StockQuantityDialog({ isOpen, onOpenChange, productInfo, logStockChange }: StockQuantityDialogProps) {
    const [amount, setAmount] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClientComponentClient();

    useEffect(() => {
        if (isOpen) {
            setAmount("");
            setError(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        if (!productInfo || !amount) return;

        const numAmount = parseInt(amount, 10);
        if (isNaN(numAmount) || numAmount <= 0) {
            setError("Por favor, insira uma quantidade válida.");
            return;
        }

        const { product, type } = productInfo;
        const change = type === 'add' ? numAmount : -numAmount;
        const newQuantity = product.quantity + change;

        if (newQuantity < 0) {
            setError("A quantidade em estoque não pode ser negativa.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const { error } = await supabase.from('stock').update({ quantity: newQuantity }).eq('id', product.id);
            if (error) throw error;
            
            await logStockChange({
                product_id: product.id,
                product_name: product.name,
                action: change > 0 ? 'Entrada Manual' : 'Saída Manual',
                details: null,
                quantity_change: change,
                old_quantity: product.quantity,
                new_quantity: newQuantity
            });

            toast.success("Quantidade atualizada!");
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message);
            toast.error("Erro ao atualizar quantidade.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm w-[90%] bg-zinc-900 text-white border-zinc-700">
                <DialogHeader>
                    <DialogTitle className="text-white">
                        {productInfo?.type === 'add' ? 'Adicionar Quantidade' : 'Remover Quantidade'}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Produto: {productInfo?.product.name}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {error && (<div className="bg-red-900/20 text-red-500 p-3 rounded-md text-sm mb-4">{error}</div>)}
                    <Label htmlFor="quantity-change">Quantidade a {productInfo?.type === 'add' ? 'adicionar' : 'remover'}</Label>
                    <Input
                        id="quantity-change"
                        type="number"
                        min="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-zinc-800 text-white border-zinc-700 mt-2"
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" disabled={isSubmitting}>Cancelar</Button>
                    <Button variant="ghost" onClick={handleConfirm} className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" disabled={isSubmitting}>
                         {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}