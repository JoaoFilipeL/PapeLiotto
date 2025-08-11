"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Trash2, ChevronUp, ChevronDown, Edit, Loader2 } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// Removido: import { Textarea } from "../ui/textarea" // Textarea não será mais usada se não houver descrição de combo

// Interface StockItem (mantida, pois é o foco principal)
interface StockItem {
    id: string
    name: string
    barcode: string
    supplier: string
    quantity: number
    unit: string
    minQuantity: number
    status: "ok" | "baixo" | "crítico"
    price: number
    category: string
}

// Removidas interfaces ComboItem e ProductCombo

const statusColors: Record<string, string> = {
    ok: "bg-green-600 text-white hover:bg-green-700",
    baixo: "bg-yellow-600 text-white hover:bg-yellow-700",
    crítico: "bg-red-600 text-white hover:bg-red-700",
}

export function StockTable() {
    const [stock, setStock] = useState<StockItem[]>([])
    // Removido: const [combos, setCombos] = useState<ProductCombo[]>([]);
    const [searchTerm, setSearchTerm] = useState("")
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    // Removido: const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)
    // Removido: const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Estados para o novo produto
    const [newItemName, setNewItemName] = useState("")
    const [newItemBarcode, setNewItemBarcode] = useState("")
    const [newItemSupplier, setNewItemSupplier] = useState("")
    const [newItemQuantity, setNewItemQuantity] = useState("")
    const [newItemUnit, setNewItemUnit] = useState("un")
    const [newItemMinQuantity, setNewItemMinQuantity] = useState("")
    const [newItemPrice, setNewItemPrice] = useState("")
    const [newItemCategory, setNewItemCategory] = useState("outros");

    // Removidos estados relacionados a combos
    // Removidos estados relacionados a edição de combos
    // Removidos estados relacionados a adição de produtos em combos

    const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<StockItem | null>(null);
    const [editProductName, setEditProductName] = useState("");
    const [editProductBarcode, setEditProductBarcode] = useState("");
    const [editProductSupplier, setEditProductSupplier] = useState("");
    const [editProductQuantity, setEditProductQuantity] = useState("");
    const [editProductUnit, setEditProductUnit] = useState("un");
    const [editProductMinQuantity, setEditProductMinQuantity] = useState("");
    const [editProductPrice, setEditProductPrice] = useState("");
    const [editProductCategory, setEditProductCategory] = useState("outros");
    const [editProductFormError, setEditProductFormError] = useState<string | null>(null);


    const supabase = createClientComponentClient();

    const calculateStatus = useCallback((quantity: number, minQuantity: number): StockItem['status'] => {
        if (quantity <= minQuantity * 0.3) {
            return "crítico";
        } else if (quantity <= minQuantity) {
            return "baixo";
        }
        return "ok";
    }, []);

    const fetchStock = useCallback(async () => { // Renomeado de fetchStockAndCombos para fetchStock
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
                category: item.category || 'outros',
            }));
            setStock(fetchedStock);

            // Removido: Lógica de fetch de combos

        } catch (err: unknown) {
            console.error("Erro inesperado ao buscar estoque:", err); // Mensagem ajustada
            if (err instanceof Error) {
                setError(err.message || "Erro ao carregar estoque."); // Mensagem ajustada
            } else {
                setError("Ocorreu um erro desconhecido ao carregar estoque."); // Mensagem ajustada
            }
        } finally {
            setLoading(false);
        }
    }, [supabase, calculateStatus]);

    useEffect(() => {
        fetchStock(); // Chamada ajustada

        // Subscrição Realtime para 'stock'
        const stockChannel = supabase
            .channel('stock_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'stock' },
                (payload) => {
                    console.log('Mudança recebida em tempo real no estoque!', payload);
                    fetchStock();
                }
            )
            .subscribe();

        // Removida: Subscrição Realtime para 'product_combos_changes'

        return () => {
            supabase.removeChannel(stockChannel);
            // Removido: supabase.removeChannel(combosChannel);
        };
    }, [supabase, fetchStock]);

    const categoryOrder: Record<string, number> = {
        "salgado": 1,
        "doce": 2,
        "bolo": 3,
        "outros": 4,
    };

    const sortedAndFilteredStock = stock
        .filter((item) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const categoryA = categoryOrder[a.category.toLowerCase()] || 99;
            const categoryB = categoryOrder[b.category.toLowerCase()] || 99;
            if (categoryA !== categoryB) {
                return categoryA - categoryB;
            }
            return a.name.localeCompare(b.name);
        });

    // Removido: filteredCombos

    const addNewItem = async () => {
        const quantity = Number.parseFloat(newItemQuantity);
        const minQuantity = Number.parseFloat(newItemMinQuantity);
        const price = Number.parseFloat(newItemPrice);

        if (!newItemName || !newItemBarcode || !newItemSupplier || isNaN(quantity) || isNaN(minQuantity) || isNaN(price) || quantity < 0 || minQuantity < 0 || price < 0 || !newItemCategory) {
            setError("Por favor, preencha todos os campos corretamente e com valores válidos.");
            return;
        }

        try {
            const { error } = await supabase
                .from('stock')
                .insert([
                    {
                        name: newItemName,
                        barcode: newItemBarcode,
                        supplier: newItemSupplier,
                        quantity: quantity,
                        unit: newItemUnit,
                        min_quantity: minQuantity,
                        price: price,
                        category: newItemCategory,
                    },
                ]);

            if (error) {
                console.error("Erro ao adicionar novo item:", error);
                setError(error.message);
                return;
            }

            setNewItemName("");
            setNewItemBarcode("");
            setNewItemSupplier("");
            setNewItemQuantity("");
            setNewItemUnit("un");
            setNewItemMinQuantity("");
            setNewItemPrice("");
            setNewItemCategory("outros");
            setIsAddDialogOpen(false);
            setError(null);
        } catch (err: unknown) {
            console.error("Erro inesperado ao adicionar item:", err);
            if (err instanceof Error) {
                setError(err.message || "Erro ao adicionar item.");
            } else {
                setError("Ocorreu um erro desconhecido ao adicionar item.");
            }
        }
    };

    // Funções para aumentar/diminuir a quantidade diretamente na tabela (mantidas)
    const updateQuantityInTable = async (itemId: string, currentQuantity: number, change: number) => {
        const newQuantity = currentQuantity + change;
        if (newQuantity < 0) return;

        try {
            const { error } = await supabase
                .from('stock')
                .update({ quantity: newQuantity })
                .eq('id', itemId);

            if (error) {
                console.error("Erro ao atualizar quantidade:", error);
                setError(error.message);
            } else {
                setError(null);
            }
        } catch (err: unknown) {
            console.error("Erro inesperado ao atualizar quantidade:", err);
            if (err instanceof Error) {
                setError(err.message || "Erro ao atualizar quantidade.");
            } else {
                setError("Ocorreu um erro desconhecido ao atualizar quantidade.");
            }
        }
    };


    const handleDeleteProduct = async (productId: string) => {
        // Substituir 'confirm' por um modal customizado no futuro
        if (!window.confirm("Tem certeza que deseja excluir este produto do estoque?")) { // Mensagem ajustada
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase
                .from('stock')
                .delete()
                .eq('id', productId);

            if (error) {
                console.error("Erro ao excluir produto:", error);
                // Remover verificação de '23503' se não houver mais FKs complexas
                setError(error.message);
            } else {
                setError(null);
            }
        } catch (err: unknown) {
            console.error("Erro inesperado ao excluir produto:", err);
            if (err instanceof Error) {
                setError(err.message || "Erro ao excluir produto.");
            } else {
                setError("Ocorreu um erro desconhecido ao excluir produto.");
            }
        } finally {
            setLoading(false);
        }
    };

    // Removido: handleDeleteCombo

    // Removido: openUpdateDialog (não é mais necessário com os botões de seta)

    const openEditProductDialog = (product: StockItem) => {
        setEditingProduct(product);
        setEditProductName(product.name);
        setEditProductBarcode(product.barcode);
        setEditProductSupplier(product.supplier);
        setEditProductQuantity(product.quantity.toString());
        setEditProductUnit(product.unit);
        setEditProductMinQuantity(product.minQuantity.toString());
        setEditProductPrice(product.price.toFixed(2));
        setEditProductCategory(product.category);
        setEditProductFormError(null);
        setIsEditProductDialogOpen(true);
    };

    const updateProduct = async () => {
        if (!editingProduct) return;

        const quantity = Number.parseFloat(editProductQuantity);
        const minQuantity = Number.parseFloat(editProductMinQuantity);
        const price = Number.parseFloat(editProductPrice);

        if (!editProductName || !editProductBarcode || !editProductSupplier || isNaN(quantity) || isNaN(minQuantity) || isNaN(price) || quantity < 0 || minQuantity < 0 || price < 0 || !editProductCategory) {
            setEditProductFormError("Por favor, preencha todos os campos corretamente e com valores válidos.");
            return;
        }

        try {
            const { error } = await supabase
                .from('stock')
                .update({
                    name: editProductName,
                    barcode: editProductBarcode,
                    supplier: editProductSupplier,
                    quantity: quantity,
                    unit: editProductUnit,
                    min_quantity: minQuantity,
                    price: price,
                    category: editProductCategory,
                })
                .eq('id', editingProduct.id);

            if (error) {
                console.error("Erro ao atualizar produto:", error);
                setEditProductFormError(error.message);
                return;
            }

            setIsEditProductDialogOpen(false);
            setEditingProduct(null);
            setEditProductFormError(null);
        } catch (err: unknown) {
            console.error("Erro inesperado ao atualizar produto:", err);
            if (err instanceof Error) {
                setEditProductFormError(err.message || "Erro ao atualizar produto.");
            } else {
                setEditProductFormError("Ocorreu um erro desconhecido ao atualizar produto.");
            }
        }
    };

    // Removidas funções relacionadas a combo: addProductToCombo, removeProductFromCombo, addNewCombo, openComboDetailsDialog

    return (
        <div className="space-y-6 p-2 md:p-4 lg:p-6 bg-zinc-900 rounded-xl">
            {loading && <div className="text-center text-white py-8 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-white" />
                <p className="text-white mt-3 text-lg">Carregando estoque...</p>
            </div>}
            {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md mb-4">{error}</div>}

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <Input
                            type="search"
                            placeholder="Buscar produto..."
                            className="pl-10 w-full bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500 rounded-md"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                {/* Botão Adicionar Produto */}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full md:w-auto bg-white text-black hover:bg-gray-200 rounded-md shadow-lg">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Produto
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                        <DialogHeader>
                            <DialogTitle className="text-white">Adicionar Novo Produto</DialogTitle>
                            <DialogDescription className="text-zinc-400">Preencha os detalhes do novo produto.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name" className="text-white">Nome do Produto</Label>
                                <Input
                                    id="name"
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    placeholder="Ex: Caderno 12 Materias"
                                    className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="barcode" className="text-white">Código de Barras</Label>
                                <Input
                                    id="barcode"
                                    value={newItemBarcode}
                                    onChange={(e) => setNewItemBarcode(e.target.value)}
                                    placeholder="Ex: 8348122837876"
                                    className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="supplier" className="text-white">Fornecedor</Label>
                                <Input
                                    id="supplier"
                                    value={newItemSupplier}
                                    onChange={(e) => setNewItemSupplier(e.target.value)}
                                    placeholder="Ex: Tilibra"
                                    className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="quantity" className="text-white">Quantidade Inicial</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        min="0"
                                        value={newItemQuantity}
                                        onChange={(e) => setNewItemQuantity(e.target.value)}
                                        className="bg-zinc-800 text-white border-zinc-700"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="price" className="text-white">Preço (R$)</Label>
                                    <Input
                                        id="price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newItemPrice}
                                        onChange={(e) => setNewItemPrice(e.target.value)}
                                        className="bg-zinc-800 text-white border-zinc-700"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="minQuantity" className="text-white">Quantidade Mínima</Label>
                                    <Input
                                        id="minQuantity"
                                        type="number"
                                        min="0"
                                        value={newItemMinQuantity}
                                        onChange={(e) => setNewItemMinQuantity(e.target.value)}
                                        className="bg-zinc-800 text-white border-zinc-700"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="unit" className="text-white">Unidade</Label>
                                    <Input
                                        id="unit"
                                        value={newItemUnit}
                                        onChange={(e) => setNewItemUnit(e.target.value)}
                                        placeholder="Ex: un"
                                        disabled
                                        className="bg-zinc-700 text-zinc-400 border-zinc-600 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="category" className="text-white">Categoria</Label>
                                <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                                    <SelectTrigger id="category" className="bg-zinc-800 text-white border-zinc-700">
                                        <SelectValue placeholder="Selecione uma categoria" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                                        <SelectItem value="salgado">Salgado</SelectItem>
                                        <SelectItem value="doce">Doce</SelectItem>
                                        <SelectItem value="bolo">Bolo</SelectItem>
                                        <SelectItem value="outros">Outros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="mt-4">
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-zinc-700 text-white hover:bg-zinc-800">
                                Cancelar
                            </Button>
                            <Button onClick={addNewItem} className="bg-white text-black hover:bg-gray-200">Adicionar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="rounded-md border border-zinc-700 overflow-x-auto mb-8 bg-zinc-800">
                <Table className="min-w-full text-white">
                    <TableHeader>
                        <TableRow className="bg-zinc-700 border-b border-zinc-600">
                            <TableHead className="text-zinc-300">Nome</TableHead>
                            <TableHead className="text-zinc-300">Código de Barras</TableHead>
                            <TableHead className="text-zinc-300">Fornecedor</TableHead>
                            <TableHead className="min-w-[80px] text-zinc-300">Preço</TableHead>
                            <TableHead className="min-w-[80px] text-zinc-300">Quantidade</TableHead>
                            <TableHead className="min-w-[80px] text-zinc-300">Status</TableHead>
                            <TableHead className="text-right min-w-[120px] text-zinc-300">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-zinc-400">
                                    Carregando dados do estoque...
                                </TableCell>
                            </TableRow>
                        ) : error && !error.includes("Não foi possível excluir") ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-red-500">
                                    {error}
                                </TableCell>
                            </TableRow>
                        ) : sortedAndFilteredStock.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-zinc-400">
                                    Nenhum produto encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedAndFilteredStock.map((item) => (
                                <TableRow key={item.id} className="border-b border-zinc-700 hover:bg-zinc-700 transition-colors">
                                    <TableCell className="font-medium text-white">{item.name}</TableCell>
                                    <TableCell className="text-zinc-300">{item.barcode}</TableCell>
                                    <TableCell className="text-zinc-300">{item.supplier}</TableCell>
                                    <TableCell className="text-zinc-300">R$ {item.price.toFixed(2)}</TableCell>
                                    <TableCell className="text-zinc-300">
                                        {item.quantity} {item.unit}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={statusColors[item.status]}>
                                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        {/* Botões de Aumentar/Diminuir Quantidade */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => updateQuantityInTable(item.id, item.quantity, -1)}
                                            className="text-red-500 hover:bg-zinc-700 hover:text-red-400 border border-red-500 rounded-md"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => updateQuantityInTable(item.id, item.quantity, 1)}
                                            className="text-green-500 hover:bg-zinc-700 hover:text-green-400 border border-green-500 rounded-md"
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </Button>
                                        {/* Botão de Editar Produto */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openEditProductDialog(item)}
                                            className="text-white hover:bg-zinc-700 border border-zinc-600 rounded-md"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        {/* Botão de Excluir Produto */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteProduct(item.id)}
                                            className="text-red-500 hover:text-red-600 hover:bg-zinc-700 border border-red-500 rounded-md"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                {error && error.includes("Não foi possível excluir") && (
                    <div className="text-center text-red-500 mt-4 p-2 border border-red-500 rounded-md bg-red-900/20">
                        {error}
                    </div>
                )}
            </div>

            {/* Removida: Seção de Combos */}

            {/* Removida: Modal de Detalhes do Combo */}
            {/* Removida: Modal de Atualização de Quantidade (já que os botões de seta fazem isso) */}

            {/* Modal de Edição de Produto (mantida e ajustada) */}
            <Dialog open={isEditProductDialogOpen} onOpenChange={setIsEditProductDialogOpen}>
                <DialogContent className="max-w-md w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle className="text-white">Editar Produto: {editingProduct?.name}</DialogTitle>
                        <DialogDescription className="text-zinc-400">Edite os detalhes do produto.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-4">
                        {editProductFormError && (
                            <div className="bg-red-900/20 text-red-500 p-3 rounded-md text-sm">
                                {editProductFormError}
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="editProductName" className="text-white">Nome do Produto</Label>
                            <Input
                                id="editProductName"
                                value={editProductName}
                                onChange={(e) => setEditProductName(e.target.value)}
                                placeholder="Ex: Caderno 12 Materias"
                                className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="editProductBarcode" className="text-white">Código de Barras</Label>
                            <Input
                                id="editProductBarcode"
                                value={editProductBarcode}
                                onChange={(e) => setEditProductBarcode(e.target.value)}
                                placeholder="Ex: 8348122837876"
                                className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="editProductSupplier" className="text-white">Fornecedor</Label>
                            <Input
                                id="editProductSupplier"
                                value={editProductSupplier}
                                onChange={(e) => setEditProductSupplier(e.target.value)}
                                placeholder="Ex: Tilibra"
                                className="bg-zinc-800 text-white border-zinc-700 placeholder:text-zinc-500"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="editProductQuantity" className="text-white">Quantidade</Label>
                                <Input
                                    id="editProductQuantity"
                                    type="number"
                                    min="0"
                                    value={editProductQuantity}
                                    onChange={(e) => setEditProductQuantity(e.target.value)}
                                    className="bg-zinc-800 text-white border-zinc-700"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="editProductPrice" className="text-white">Preço (R$)</Label>
                                <Input
                                    id="editProductPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editProductPrice}
                                    onChange={(e) => setEditProductPrice(e.target.value)}
                                    className="bg-zinc-800 text-white border-zinc-700"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="editProductMinQuantity" className="text-white">Quantidade Mínima</Label>
                                <Input
                                    id="editProductMinQuantity"
                                    type="number"
                                    min="0"
                                    value={editProductMinQuantity}
                                    onChange={(e) => setEditProductMinQuantity(e.target.value)}
                                    className="bg-zinc-800 text-white border-zinc-700"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="editProductUnit" className="text-white">Unidade</Label>
                                <Input
                                    id="editProductUnit"
                                    value={editProductUnit}
                                    onChange={(e) => setEditProductUnit(e.target.value)}
                                    placeholder="Ex: un"
                                    disabled
                                    className="bg-zinc-700 text-zinc-400 border-zinc-600 cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="editProductCategory" className="text-white">Categoria</Label>
                            <Select value={editProductCategory} onValueChange={setEditProductCategory}>
                                <SelectTrigger id="editProductCategory" className="bg-zinc-800 text-white border-zinc-700">
                                    <SelectValue placeholder="Selecione uma categoria" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                                    <SelectItem value="salgado">Salgado</SelectItem>
                                    <SelectItem value="doce">Doce</SelectItem>
                                    <SelectItem value="bolo">Bolo</SelectItem>
                                    <SelectItem value="outros">Outros</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsEditProductDialogOpen(false)} className="border-zinc-700 text-white hover:bg-zinc-800">
                            Cancelar
                        </Button>
                        <Button onClick={updateProduct} className="bg-white text-black hover:bg-gray-200">
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
