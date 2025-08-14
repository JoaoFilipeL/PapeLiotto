'use client'
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Trash2, ArrowUp, ArrowDown, Loader2, Archive } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface StockItem {
    id: string
    name: string
    barcode: string
    supplier: string
    quantity: number
    unit: string
    minQuantity: number
    price: number
    status: "ok" | "baixo" | "crítico"
}

const statusColors: Record<StockItem['status'], string> = {
    ok: "bg-green-600 text-white hover:bg-green-700",
    baixo: "bg-yellow-600 text-white hover:bg-yellow-700",
    crítico: "bg-red-600 text-white hover:bg-red-700",
}

const initialNewItemState = {
    name: "",
    barcode: "",
    supplier: "",
    quantity: "",
    unit: "un",
    minQuantity: "",
    price: "",
}

export function StockTable() {
    const [stock, setStock] = useState<StockItem[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newItem, setNewItem] = useState(initialNewItemState);
    const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<StockItem | null>(null);
    const [editProductFormError, setEditProductFormError] = useState<string | null>(null);
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

    const calculateStatus = useCallback((quantity: number, minQuantity: number): StockItem['status'] => {
        if (quantity <= 0) {
            return "crítico";
        } else if (quantity <= minQuantity) {
            return "baixo";
        }
        return "ok";
    }, []);

    const fetchStock = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: stockData, error: stockError } = await supabase
                .from('stock')
                .select('*')
                .order('name', { ascending: true });

            if (stockError) {
                console.error("Erro ao buscar estoque:", stockError);
                setError(`Erro ao buscar estoque: ${stockError.message}`);
                return;
            }

            const fetchedStock: StockItem[] = stockData.map(item => ({
                id: item.id,
                name: item.name,
                barcode: item.barcode || '',
                supplier: item.supplier || '',
                quantity: item.quantity,
                unit: item.unit,
                minQuantity: item.min_quantity,
                status: calculateStatus(item.quantity, item.min_quantity),
                price: parseFloat(item.price),
            }));
            setStock(fetchedStock);

        } catch (err: unknown) {
            console.error("Erro inesperado ao buscar estoque:", err);
            if (err instanceof Error) {
                setError(err.message || "Erro ao carregar estoque.");
            } else {
                setError("Ocorreu um erro desconhecido ao carregar estoque.");
            }
        } finally {
            setLoading(false);
        }
    }, [supabase, calculateStatus]);

    useEffect(() => {
        fetchStock();
        const stockChannel = supabase
            .channel('stock_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => fetchStock())
            .subscribe();
        return () => { supabase.removeChannel(stockChannel); };
    }, [supabase, fetchStock]);

    const sortedAndFilteredStock = stock
        .filter((item) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name));

    const handleNewItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setNewItem(prev => ({ ...prev, [id]: id === 'barcode' ? value.replace(/\D/g, '').substring(0, 13) : value }));
    };

    const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setEditForm(prev => ({ ...prev, [id]: id === 'barcode' ? value.replace(/\D/g, '').substring(0, 13) : value }));
    };

    const addNewItem = async () => {
        const { name, barcode, supplier, quantity, unit, minQuantity, price } = newItem;
        const parsedQuantity = Number.parseFloat(quantity);
        const parsedMinQuantity = Number.parseFloat(minQuantity);
        const parsedPrice = Number.parseFloat(price);
        if (!name || !barcode || !supplier || isNaN(parsedQuantity) || isNaN(parsedMinQuantity) || isNaN(parsedPrice) || parsedQuantity < 0 || parsedMinQuantity < 0 || parsedPrice < 0) {
            setError("Por favor, preencha todos os campos corretamente e com valores válidos.");
            return;
        }
        try {
            const { error } = await supabase.from('stock').insert([{ name, barcode, supplier, quantity: parsedQuantity, unit, min_quantity: parsedMinQuantity, price: parsedPrice, }]);
            if (error) { console.error("Erro ao adicionar novo item:", error); setError(error.message); return; }
            setNewItem(initialNewItemState); setIsAddDialogOpen(false); setError(null);
        } catch (err: unknown) { console.error("Erro inesperado ao adicionar item:", err); setError("Ocorreu um erro desconhecido ao adicionar item."); }
    };

    const updateQuantityInTable = async (itemId: string, currentQuantity: number, change: number) => {
        const newQuantity = currentQuantity + change;
        if (newQuantity < 0) return;
        try {
            const { error } = await supabase.from('stock').update({ quantity: newQuantity }).eq('id', itemId);
            if (error) { console.error("Erro ao atualizar quantidade:", error); setError(error.message); } else { setError(null); }
        } catch (err: unknown) { console.error("Erro inesperado ao atualizar quantidade:", err); setError("Ocorreu um erro desconhecido ao atualizar quantidade."); }
    };

    const handleDeleteProduct = async (productId: string) => {
        const confirmDelete = prompt("Tem certeza que deseja excluir este produto do estoque? Digite 'sim' para confirmar.");
        if (confirmDelete?.toLowerCase() !== 'sim') { return; }
        setLoading(true); setError(null);
        try {
            const { error } = await supabase.from('stock').delete().eq('id', productId);
            if (error) { console.error("Erro ao excluir produto:", error); setError(error.message); } else { setError(null); setIsEditProductDialogOpen(false); }
        } catch (err: unknown) { console.error("Erro inesperado ao excluir produto:", err); setError("Ocorreu um erro desconhecido ao excluir produto."); } finally { setLoading(false); }
    };

    const openEditProductDialog = (product: StockItem) => {
        setEditingProduct(product);
        setEditForm({
            name: product.name,
            barcode: product.barcode,
            supplier: product.supplier,
            quantity: product.quantity.toString(),
            unit: product.unit,
            minQuantity: product.minQuantity.toString(),
            price: product.price.toFixed(2),
        });
        setEditProductFormError(null);
        setIsEditProductDialogOpen(true);
    };

    const updateProduct = async () => {
        if (!editingProduct) return;
        const { name, barcode, supplier, quantity, unit, minQuantity, price } = editForm;
        const parsedQuantity = Number.parseFloat(quantity);
        const parsedMinQuantity = Number.parseFloat(minQuantity);
        const parsedPrice = Number.parseFloat(price);
        if (!name || !barcode || !supplier || isNaN(parsedQuantity) || isNaN(parsedMinQuantity) || isNaN(parsedPrice) || parsedQuantity < 0 || parsedMinQuantity < 0 || parsedPrice < 0) {
            setEditProductFormError("Por favor, preencha todos os campos corretamente e com valores válidos."); return;
        }
        try {
            const { error } = await supabase.from('stock').update({ name, barcode, supplier, quantity: parsedQuantity, unit, min_quantity: parsedMinQuantity, price: parsedPrice, }).eq('id', editingProduct.id);
            if (error) { console.error("Erro ao atualizar produto:", error); setEditProductFormError(error.message); return; }
            setIsEditProductDialogOpen(false); setEditingProduct(null); setEditProductFormError(null);
        } catch (err: unknown) { console.error("Erro inesperado ao atualizar produto:", err); setEditProductFormError("Ocorreu um erro desconhecido ao atualizar produto."); }
    };

    const renderDialogContent = (isEdit = false) => {
        const formState = isEdit ? editForm : newItem;
        const handleInputChange = isEdit ? handleEditFormChange : handleNewItemChange;
        const formError = isEdit ? editProductFormError : error;
        return (
            <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                {formError && (<div className="bg-red-900/20 text-red-500 p-3 rounded-md text-sm">{formError}</div>)}
                <div className="grid gap-2"><Label htmlFor="name" className="text-white">Nome do Produto</Label><Input id="name" value={formState.name} onChange={handleInputChange} placeholder="Ex: Caderno 12 Materias" className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500" /></div>
                <div className="grid gap-2"><Label htmlFor="barcode" className="text-white">Código de Barras</Label><Input id="barcode" value={formState.barcode} onChange={handleInputChange} placeholder="Ex: 8348122837876" type="text" className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500" /></div>
                <div className="grid gap-2"><Label htmlFor="supplier" className="text-white">Fornecedor</Label><Input id="supplier" value={formState.supplier} onChange={handleInputChange} placeholder="Ex: Tilibra" className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500" /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label htmlFor="quantity" className="text-white">Quantidade {isEdit ? '' : 'Inicial'}</Label><Input id="quantity" type="number" min="0" value={formState.quantity} onChange={handleInputChange} className="bg-zinc-800 text-white border-zinc-700" /></div>
                    <div className="grid gap-2"><Label htmlFor="price" className="text-white">Preço (R$)</Label><Input id="price" type="number" step="0.01" min="0" value={formState.price} onChange={handleInputChange} className="bg-zinc-800 text-white border-zinc-700" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label htmlFor="minQuantity" className="text-white">Quantidade Mínima</Label><Input id="minQuantity" type="number" min="0" value={formState.minQuantity} onChange={handleInputChange} className="bg-zinc-800 text-white border-zinc-700" /></div>
                    <div className="grid gap-2"><Label htmlFor="unit" className="text-white">Unidade</Label><Input id="unit" value={formState.unit} onChange={handleInputChange} placeholder="Ex: un" disabled className="bg-zinc-700 text-zinc-400 border-zinc-600 cursor-not-allowed" /></div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                <h1 className="text-white text-3xl font-bold">Estoque</h1>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input
                            type="search"
                            placeholder="Buscar produto..."
                            className="pl-10 w-full bg-[#1C1C1C] text-white border-zinc-600 placeholder:text-zinc-500 rounded-lg"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full sm:w-auto bg-white text-black hover:bg-gray-200 rounded-lg font-semibold py-2 px-4 flex items-center gap-2">
                                <Archive className="h-5 w-5" />
                                Adicionar Produto
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                            <DialogHeader><DialogTitle className="text-white">Adicionar Novo Produto</DialogTitle><DialogDescription className="text-zinc-400">Preencha os detalhes do novo produto.</DialogDescription></DialogHeader>
                            {renderDialogContent()}
                            <DialogFooter className="mt-4"><Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto bg-zinc-700 text-white hover:bg-zinc-600 border-zinc-600">Cancelar</Button><Button onClick={addNewItem} className="bg-white text-black hover:bg-gray-200">Adicionar</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {loading && <div className="text-center text-white py-8"><Loader2 className="h-10 w-10 animate-spin text-white mx-auto" /><p className="mt-3">Carregando...</p></div>}
            {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md">{error}</div>}

            {!loading && !error && sortedAndFilteredStock.length > 0 && (
                <div className="flex items-center px-3 pb-2 mb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="flex-1 text-left pr-4">Nome</div>
                    <div className="flex-1 text-left pr-4">Código de Barras</div>
                    <div className="flex-1 text-left pr-4">Fornecedor</div>
                    <div className="flex-1 text-left pr-4">Preço</div>
                    <div className="flex-1 text-left pr-4">Qtd</div>
                    <div className="flex-1 text-left pr-4">Status</div>
                    <div style={{ width: '110px' }} className="text-center">Ações</div>
                </div>
            )}
            
            <div className="space-y-2">
                {!loading && sortedAndFilteredStock.length > 0 && (
                    sortedAndFilteredStock.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center bg-[#1C1C1C] p-3 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors duration-200"
                            onClick={() => openEditProductDialog(item)}
                        >
                            <div className="flex-1 text-left pr-4 text-white font-medium truncate">{item.name}</div>
                            <div className="flex-1 text-left pr-4 text-zinc-400 truncate">{item.barcode}</div>
                            <div className="flex-1 text-left pr-4 text-zinc-400 truncate">{item.supplier}</div>
                            <div className="flex-1 text-left pr-4 text-zinc-400 truncate">{item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            <div className="flex-1 text-left pr-4 text-zinc-400 truncate">{item.quantity}</div>
                            <div className="flex-1 text-left pr-4">
                                <Badge className={`${statusColors[item.status]} text-xs font-semibold`}>
                                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                </Badge>
                            </div>
                            <div style={{ width: '110px' }} className="flex items-center justify-center gap-2">
                                <Button
                                    onClick={(e) => { e.stopPropagation(); updateQuantityInTable(item.id, item.quantity, -1); }}
                                    className="cursor-pointer bg-red-500 hover:bg-red-600 text-white rounded-md h-8 w-12 p-0 flex items-center justify-center"
                                >
                                    <ArrowDown className="h-5 w-5" />
                                </Button>
                                <Button
                                    onClick={(e) => { e.stopPropagation(); updateQuantityInTable(item.id, item.quantity, 1); }}
                                    className="cursor-pointer bg-green-500 hover:bg-green-600 text-white rounded-md h-8 w-12 p-0 flex items-center justify-center"
                                >
                                    <ArrowUp className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
                {!loading && sortedAndFilteredStock.length === 0 && !error && (
                    <div className="text-center text-zinc-500 py-10">Nenhum produto encontrado.</div>
                )}
            </div>
            
            <Dialog open={isEditProductDialogOpen} onOpenChange={setIsEditProductDialogOpen}>
                <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader><DialogTitle className="text-white">Editar Produto: {editingProduct?.name}</DialogTitle><DialogDescription className="text-zinc-400">Edite os detalhes do produto.</DialogDescription></DialogHeader>
                    {renderDialogContent(true)}
                    <DialogFooter className="mt-4 mr-5 flex flex-col sm:flex-row justify-between items-center gap-12">
                        <Button variant="ghost" onClick={() => handleDeleteProduct(editingProduct?.id || '')} className="w-full sm:w-auto text-red-500 hover:bg-zinc-700 hover:text-red-400 border border-red-500 rounded-md" disabled={loading}><Trash2 className="mr-2 h-4 w-4" /> Excluir Produto</Button>
                        <div className="flex gap-2 w-full sm:w-auto justify-end"><Button variant="outline" onClick={() => setIsEditProductDialogOpen(false)} className="w-full sm:w-auto bg-zinc-700 text-white hover:bg-zinc-600 border-zinc-600">Cancelar</Button><Button onClick={updateProduct} className="w-full sm:w-auto bg-white text-black hover:bg-gray-200">Salvar Alterações</Button></div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}