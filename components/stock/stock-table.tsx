'use client'
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Trash2, ArrowUp, ArrowDown, Loader2, Archive, History } from "lucide-react"
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
import { createClientComponentClient, User } from '@supabase/auth-helpers-nextjs';

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

interface UserProfile {
    role: string | null;
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

    const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
    const [quantityChangeInfo, setQuantityChangeInfo] = useState<{ product: StockItem; type: 'add' | 'subtract' } | null>(null);
    const [quantityChangeAmount, setQuantityChangeAmount] = useState("");

    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
    const [modalSearchTerm, setModalSearchTerm] = useState("");

    const supabase = createClientComponentClient();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
            if (user) {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                if (error && error.code !== 'PGRST116') console.error("Erro ao buscar perfil:", error);
                setUserProfile(profile);
            }
        };
        fetchUserData();
    }, [supabase]);


    const calculateStatus = useCallback((quantity: number, minQuantity: number): StockItem['status'] => {
        if (quantity <= 0) {
            return "crítico";
        } else if (quantity <= minQuantity) {
            return "baixo";
        }
        return "ok";
    }, []);

    const logStockChange = async (details: {
        product_id: string;
        product_name: string;
        action: string;
        details?: string | null;
        quantity_change?: number;
        old_quantity?: number;
        new_quantity?: number;
    }) => {
        try {
            await supabase.from('stock_history').insert([{
                ...details,
                user_email: currentUser?.email ?? 'N/A'
            }]);
        } catch (logError) {
            console.error("Failed to log stock change:", logError);
        }
    };

    const fetchStock = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: stockData, error: stockError } = await supabase
                .from('stock')
                .select('*')
                .order('name', { ascending: true });

            if (stockError) throw stockError;

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

        } catch (err: any) {
            setError(err.message || "Ocorreu um erro desconhecido.");
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

    const sortedStock = [...stock].sort((a, b) => a.name.localeCompare(b.name));

    const filteredModalStock = stock.filter(item =>
        item.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
        item.barcode.toLowerCase().includes(modalSearchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));


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
            const { data, error } = await supabase.from('stock').insert([{ name, barcode, supplier, quantity: parsedQuantity, unit, min_quantity: parsedMinQuantity, price: parsedPrice, }]).select().single();
            if (error) { throw error; }
            
            await logStockChange({
                product_id: data.id,
                product_name: name,
                action: 'Produto Adicionado',
                quantity_change: parsedQuantity,
                old_quantity: 0,
                new_quantity: parsedQuantity
            });

            setNewItem(initialNewItemState); setIsAddDialogOpen(false); setError(null);
        } catch (err: any) { console.error("Erro inesperado ao adicionar item:", err); setError(err.message); }
    };

    const openQuantityDialog = (product: StockItem, type: 'add' | 'subtract') => {
        setQuantityChangeInfo({ product, type });
        setQuantityChangeAmount("");
        setIsQuantityDialogOpen(true);
    };

    const handleConfirmQuantityChange = async () => {
        if (!quantityChangeInfo || !quantityChangeAmount) return;

        const amount = parseInt(quantityChangeAmount, 10);
        if (isNaN(amount) || amount <= 0) {
            alert("Por favor, insira uma quantidade válida.");
            return;
        }

        const { product, type } = quantityChangeInfo;
        const change = type === 'add' ? amount : -amount;
        const newQuantity = product.quantity + change;

        if (newQuantity < 0) {
            alert("A quantidade em estoque não pode ser negativa.");
            return;
        }

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

            setIsQuantityDialogOpen(false);
            setQuantityChangeInfo(null);
        } catch (err: any) {
            setError(err.message);
        }
    };


    const handleDeleteProduct = async (productId: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) { return; }
        
        const productToDelete = stock.find(p => p.id === productId);
        if (!productToDelete) return;

        setLoading(true); setError(null);
        try {
            const { error } = await supabase.from('stock').delete().eq('id', productId);
            if (error) throw error;
            
            await logStockChange({
                product_id: productId,
                product_name: productToDelete.name,
                action: 'Produto Excluído',
                quantity_change: -productToDelete.quantity,
                old_quantity: productToDelete.quantity,
                new_quantity: 0
            });
            
            setError(null); setIsEditProductDialogOpen(false);
        } catch (err: any) { setError(err.message); } finally { setLoading(false); }
    };

    const openEditProductDialog = (product: StockItem) => {
        if (userProfile?.role !== 'Gerente') return;

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

        const changes: string[] = [];
        if (editingProduct.name !== name) changes.push(`Nome: '${editingProduct.name}' -> '${name}'`);
        if (editingProduct.barcode !== barcode) changes.push('Código de Barras alterado');
        if (editingProduct.supplier !== supplier) changes.push(`Fornecedor: '${editingProduct.supplier}' -> '${supplier}'`);
        if (editingProduct.price !== parsedPrice) changes.push(`Preço: R$${editingProduct.price.toFixed(2)} -> R$${parsedPrice.toFixed(2)}`);
        if (editingProduct.minQuantity !== parsedMinQuantity) changes.push(`Qtd. Mínima: ${editingProduct.minQuantity} -> ${parsedMinQuantity}`);
        
        const quantityChange = parsedQuantity - editingProduct.quantity;

        try {
            const { error } = await supabase.from('stock').update({ name, barcode, supplier, quantity: parsedQuantity, unit, min_quantity: parsedMinQuantity, price: parsedPrice, }).eq('id', editingProduct.id);
            if (error) throw error;
            
            if (changes.length > 0 || quantityChange !== 0) {
                await logStockChange({
                    product_id: editingProduct.id,
                    product_name: name,
                    action: 'Produto Editado',
                    details: changes.length > 0 ? changes.join('; ') : 'Apenas a quantidade foi alterada.',
                    quantity_change: quantityChange,
                    old_quantity: editingProduct.quantity,
                    new_quantity: parsedQuantity
                });
            }

            setIsEditProductDialogOpen(false); setEditingProduct(null); setEditProductFormError(null);
        } catch (err: any) { setEditProductFormError(err.message); }
    };

    const renderDialogContent = (isEdit = false) => {
        const formState = isEdit ? editForm : newItem;
        const handleInputChange = isEdit ? handleEditFormChange : handleNewItemChange;
        const formError = isEdit ? editProductFormError : error;
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

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                <h1 className="text-white text-3xl font-bold">Estoque</h1>
                <div className="flex flex-col sm:flex-row items-center gap-10 w-full md:w-auto">

                    <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer">
                                <Search className="h-5 w-5" />
                                Consultar produtos
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-6xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                            <DialogHeader>
                                <DialogTitle>Consultar produtos</DialogTitle>
                            </DialogHeader>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                <Input
                                    type="search"
                                    placeholder="Buscar por nome ou código de barras..."
                                    className="pl-10 w-full bg-[#1C1C1C] text-white border-zinc-600 placeholder:text-zinc-500 rounded-lg"
                                    value={modalSearchTerm}
                                    onChange={(e) => setModalSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2 mt-4">
                                {filteredModalStock.length > 0 ? (
                                    filteredModalStock.map(item => (
                                        <div key={item.id} className="grid grid-cols-3 items-center gap-4 p-3 bg-zinc-800 rounded-lg">
                                            <div className="col-span-1">
                                                <p className="font-bold text-white truncate">{item.name}</p>
                                                <p className="text-xs text-zinc-400 font-mono">{item.barcode}</p>
                                            </div>
                                            <div className="col-span-1 text-center font-semibold text-zinc-300">
                                                {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </div>
                                            <div className="col-span-1 flex justify-end">
                                                 <Badge className={`${statusColors[item.status]} text-xs font-semibold`}>
                                                    {item.quantity} {item.unit}.
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-zinc-500 py-8">Nenhum produto encontrado.</p>
                                )}
                            </div>
                            <DialogFooter className="mt-4">
                                <Button className="cursor-pointer hover:bg-zinc-700" onClick={() => setIsSearchDialogOpen(false)}>Fechar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Link href="/stock/history" passHref>
                        <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer">
                            <History className="h-5 w-5" />
                            Histórico
                        </Button>
                    </Link>
                    {userProfile?.role === 'Gerente' && (
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                 <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer">
                                    <Archive className="h-5 w-5" />
                                    Adicionar Produto
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                                <DialogHeader><DialogTitle>Adicionar Novo Produto</DialogTitle><DialogDescription className="text-zinc-400">Preencha os detalhes do novo produto.</DialogDescription></DialogHeader>
                                {renderDialogContent()}
                                <DialogFooter className="mt-4">
                                    <Button variant="ghost" className="cursor-pointer hover:bg-zinc-700" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                                    <Button className="cursor-pointer hover:bg-zinc-700" onClick={addNewItem}>Adicionar</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {loading && <div className="text-center text-white py-8"><Loader2 className="h-10 w-10 animate-spin text-white mx-auto" /><p className="mt-3">Carregando...</p></div>}
            {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md">{error}</div>}

            {!loading && !error && sortedStock.length > 0 && (
                <div className="hidden md:grid md:grid-cols-7 items-center gap-x-4 px-3 pb-2 mb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="col-span-2 text-left">Nome</div>
                    <div className="col-span-1 text-left">Fornecedor</div>
                    <div className="col-span-1 text-center">Preço</div>
                    <div className="col-span-1 text-center">Qtd</div>
                    <div className="col-span-1 text-center">Status</div>
                    <div className="col-span-1 text-center">Ações</div>
                </div>
            )}
            
            <div className="space-y-2">
                {!loading && sortedStock.length > 0 && (
                    sortedStock.map((item) => (
                        <div
                            key={item.id}
                            className={`grid grid-cols-1 md:grid-cols-7 items-center gap-x-4 bg-[#1C1C1C] p-3 rounded-lg hover:bg-zinc-800 transition-colors duration-200 text-sm ${userProfile?.role === 'Gerente' ? 'cursor-pointer' : 'cursor-default'}`}
                            onClick={() => openEditProductDialog(item)}
                        >
                            <div className="col-span-2 text-left text-white font-medium truncate">{item.name}</div>
                            <div className="col-span-1 text-left text-zinc-400 truncate">{item.supplier}</div>
                            <div className="col-span-1 text-center text-zinc-300 truncate">{item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            <div className="col-span-1 text-center text-zinc-300 truncate">{item.quantity}</div>
                            <div className="col-span-1 flex justify-center">
                                <Badge className={`${statusColors[item.status]} text-xs font-semibold`}>
                                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                </Badge>
                            </div>
                            <div className="col-span-1 flex items-center justify-center gap-2">
                                <Button
                                    onClick={(e) => { e.stopPropagation(); openQuantityDialog(item, 'subtract'); }}
                                    className="cursor-pointer bg-red-600 hover:bg-red-700 text-white rounded-md h-8 w-12 p-0 flex items-center justify-center"
                                >
                                    <ArrowDown className="h-5 w-5" />
                                </Button>
                                <Button
                                    onClick={(e) => { e.stopPropagation(); openQuantityDialog(item, 'add'); }}
                                    className="cursor-pointer bg-green-600 hover:bg-green-700 text-white rounded-md h-8 w-12 p-0 flex items-center justify-center"
                                >
                                    <ArrowUp className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
                {!loading && sortedStock.length === 0 && !error && (
                    <div className="text-center text-zinc-500 py-10">Nenhum produto encontrado.</div>
                )}
            </div>
            
            <Dialog open={isEditProductDialogOpen} onOpenChange={setIsEditProductDialogOpen}>
                <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader><DialogTitle>Editar Produto: {editingProduct?.name}</DialogTitle><DialogDescription className="text-zinc-400">Edite os detalhes do produto.</DialogDescription></DialogHeader>
                    {renderDialogContent(true)}
                    <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-between w-full">
                        {userProfile?.role === 'Gerente' && (
                            <Button variant="ghost" onClick={() => handleDeleteProduct(editingProduct?.id || '')} className="w-full sm:w-auto justify-center text-red-600 hover:bg-red-900/20 hover:text-red-500 cursor-pointer" disabled={loading}><Trash2 className="mr-2 h-4 w-4" />Excluir Produto</Button>
                        )}
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="ghost" className="cursor-pointer hover:bg-zinc-700" onClick={() => setIsEditProductDialogOpen(false)}>Cancelar</Button>
                            <Button className="cursor-pointer hover:bg-zinc-700" onClick={updateProduct}>Salvar Alterações</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isQuantityDialogOpen} onOpenChange={setIsQuantityDialogOpen}>
                <DialogContent className="max-w-sm w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle className="text-white">
                            {quantityChangeInfo?.type === 'add' ? 'Adicionar Quantidade' : 'Remover Quantidade'}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Produto: {quantityChangeInfo?.product.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="quantity-change">Quantidade a {quantityChangeInfo?.type === 'add' ? 'adicionar' : 'remover'}</Label>
                        <Input
                            id="quantity-change"
                            type="number"
                            min="1"
                            value={quantityChangeAmount}
                            onChange={(e) => setQuantityChangeAmount(e.target.value)}
                            className="bg-zinc-800 text-white border-zinc-700 mt-2"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsQuantityDialogOpen(false)} className="cursor-pointer hover:bg-zinc-700">Cancelar</Button>
                        <Button onClick={handleConfirmQuantityChange} className="cursor-pointer hover:bg-zinc-700">Confirmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}