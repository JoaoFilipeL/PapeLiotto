'use client'
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, History, ArrowUp, ArrowDown } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { StockItem, UserProfile, CurrentUser, statusColors } from "./types/stock";
import { AddStockProductDialog, EditStockProductDialog, StockQuantityDialog } from "./stock-modals";
import { toast } from "sonner"

export function StockTable() {
    const [stock, setStock] = useState<StockItem[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editingProduct, setEditingProduct] = useState<StockItem | null>(null);
    const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);

    const [quantityChangeInfo, setQuantityChangeInfo] = useState<{ product: StockItem; type: 'add' | 'subtract' } | null>(null);
    const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
    
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
    const [modalSearchTerm, setModalSearchTerm] = useState("");

    const supabase = createClientComponentClient();
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
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
                if (error && error.code !== 'PGRST116') {
                    console.error("Erro ao buscar perfil:", error);
                    toast.error("Erro ao carregar dados do usuário.");
                }
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
            const { error } = await supabase.from('stock_history').insert([{
                ...details,
                user_email: currentUser?.email ?? 'N/A'
            }]);
            if (error) throw error;
        } catch (logError: any) {
            console.error("Failed to log stock change:", logError);
            toast.error("Falha ao registrar histórico: " + logError.message);
        }
    };

    const fetchStock = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: stockData, error: stockError } = await supabase
                .from('stock')
                .select('*')
                .eq('is_archived', false)
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
            toast.error("Erro ao carregar estoque.");
        } finally {
            setLoading(false);
        }
    }, [supabase, calculateStatus]);

    useEffect(() => {
        fetchStock();
        const stockChannel = supabase
            .channel('stock_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, (payload) => {
                fetchStock();
            })
            .subscribe();
        return () => { supabase.removeChannel(stockChannel); };
    }, [supabase, fetchStock]);

    const sortedStock = [...stock].sort((a, b) => a.name.localeCompare(b.name));
    
    const filteredModalStock = stock.filter(item =>
        item.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
        item.barcode.toLowerCase().includes(modalSearchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));

    const openEditProductDialog = (product: StockItem) => {
        if (userProfile?.role !== 'Gerente') {
            toast.info("Apenas gerentes podem editar produtos.");
            return;
        };
        setEditingProduct(product);
        setIsEditProductDialogOpen(true);
    };

     const openQuantityDialog = (product: StockItem, type: 'add' | 'subtract') => {
        setQuantityChangeInfo({ product, type });
        setIsQuantityDialogOpen(true);
    };

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                <h1 className="text-white text-3xl font-bold">Estoque</h1>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    
                    <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer">
                                <Search className="h-5 w-5" />
                                Consultar produtos
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:max-w-5xl bg-zinc-900 text-white border-zinc-700">
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
                            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 mt-4">
                                {filteredModalStock.length > 0 ? (
                                    filteredModalStock.map(item => (
                                        <div key={item.id} className="grid grid-cols-5 items-center gap-4 p-4 bg-zinc-800 rounded-lg">
                                            <div className="col-span-2">
                                                <p className="font-bold text-white truncate text-base">{item.name}</p>
                                                <p className="text-sm text-zinc-400 font-mono">{item.barcode}</p>
                                            </div>
                                            <div className="col-span-1 text-center text-sm text-zinc-400 truncate">
                                                {item.supplier}
                                            </div>
                                            <div className="col-span-1 text-right font-semibold text-zinc-300 text-base">
                                                {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </div>
                                            <div className="col-span-1 flex justify-end">
                                                 <Badge className={`${statusColors[item.status]} text-sm font-semibold`}>
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

                    {userProfile?.role === 'Gerente' && (
                        <AddStockProductDialog 
                            logStockChange={logStockChange}
                            currentUser={currentUser}
                        />
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
            
            <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-2">
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
            
            <div className="flex justify-end mt-6">
                <Link href="/stock/history" passHref>
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent text-white hover:bg-zinc-700 hover:text-white rounded-lg font-semibold py-2 px-4 flex items-center gap-2 cursor-pointer">
                        <History className="h-5 w-5" />
                        Histórico
                    </Button>
                </Link>
            </div>

            <EditStockProductDialog
                isOpen={isEditProductDialogOpen}
                onOpenChange={setIsEditProductDialogOpen}
                product={editingProduct}
                logStockChange={logStockChange}
                userProfile={userProfile}
            />

            <StockQuantityDialog
                isOpen={isQuantityDialogOpen}
                onOpenChange={setIsQuantityDialogOpen}
                productInfo={quantityChangeInfo}
                logStockChange={logStockChange}
            />
        </div>
    )
}