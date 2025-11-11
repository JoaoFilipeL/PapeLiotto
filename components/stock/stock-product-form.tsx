'use client'
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface FormState {
    name: string;
    barcode: string;
    supplier: string;
    quantity: string;
    unit: string;
    minQuantity: string;
    price: string;
}

interface StockProductFormProps {
    formState: FormState;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    formError: string | null;
    isEdit?: boolean;
}

export function StockProductForm({ formState, handleInputChange, formError, isEdit = false }: StockProductFormProps) {
    return (
        <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
            {formError && (<div className="bg-red-900/20 text-red-500 p-3 rounded-md text-sm">{formError}</div>)}
            <div className="grid gap-2"><Label htmlFor="name">Nome do Produto</Label><Input id="name" value={formState.name} onChange={handleInputChange} placeholder="Ex: Caderno 12 Materias" className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500" /></div>
            <div className="grid gap-2"><Label htmlFor="barcode">Código de Barras</Label><Input id="barcode" value={formState.barcode} onChange={handleInputChange} placeholder="Ex: 8348122837876" type="text" className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500" /></div>
            <div className="grid gap-2"><Label htmlFor="supplier">Fornecedor</Label><Input id="supplier" value={formState.supplier} onChange={handleInputChange} placeholder="Ex: Tilibra" className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label htmlFor="quantity">Quantidade {isEdit ? '' : 'Inicial'}</Label><Input id="quantity" type="number" min="0" value={formState.quantity} onChange={handleInputChange} className="bg-zinc-800 text-white border-zinc-700" /></div>
                <div className="grid gap-2"><Label htmlFor="price">Preço (R$)</Label><Input id="price" type="number" step="0.01" min="0" value={formState.price} onChange={handleInputChange} className="bg-zinc-800 text-white border-zinc-700" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label htmlFor="minQuantity">Quantidade Mínima</Label><Input id="minQuantity" type="number" min="0" value={formState.minQuantity} onChange={handleInputChange} className="bg-zinc-800 text-white border-zinc-700" /></div>
                <div className="grid gap-2"><Label htmlFor="unit">Unidade</Label><Input id="unit" value={formState.unit} onChange={handleInputChange} placeholder="Ex: un" disabled className="bg-zinc-700 text-zinc-400 border-zinc-600 cursor-not-allowed" /></div>
            </div>
        </div>
    )
}