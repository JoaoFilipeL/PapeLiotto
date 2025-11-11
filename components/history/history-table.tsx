'use client'
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from "next/link";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, ArrowLeft } from "lucide-react"

interface StockHistoryLog {
    id: string;
    created_at: string;
    product_name: string;
    user_email: string;
    action: string;
    details: string | null;
    quantity_change: number | null;
    old_quantity: number | null;
    new_quantity: number | null;
}

export function HistoryTable() {
    const [logs, setLogs] = useState<StockHistoryLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const supabase = createClientComponentClient();

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('stock_history')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (err: any) {
            setError(err.message || "Erro ao carregar histórico.");
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchHistory();

        const historyChannel = supabase
            .channel('stock_history_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_history' }, 
                (payload) => {
                    setLogs((currentLogs) => [payload.new as StockHistoryLog, ...currentLogs]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(historyChannel);
        };
    }, [supabase, fetchHistory]);

    const filteredLogs = useMemo(() => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        return logs.filter(log =>
            (log.product_name && log.product_name.toLowerCase().includes(lowerSearchTerm)) ||
            (log.user_email && log.user_email.toLowerCase().includes(lowerSearchTerm)) ||
            log.action.toLowerCase().includes(lowerSearchTerm)
        );
    }, [logs, searchTerm]);

    const formatChange = (log: StockHistoryLog) => {
        if (log.details) {
            return <span className="text-zinc-300">{log.details}</span>;
        }
        
        if (log.quantity_change !== null && log.quantity_change !== 0) {
            const { quantity_change, old_quantity, new_quantity } = log;
            const sign = quantity_change > 0 ? '+' : '';
            const color = quantity_change > 0 ? 'text-green-400' : 'text-red-400';
            
            return (
                <div className="flex items-center gap-2">
                    <span className={`${color} font-mono font-bold`}>{sign}{quantity_change}</span>
                    <span className="text-zinc-500 font-mono hidden lg:inline">
                        ({old_quantity} &rarr; {new_quantity})
                    </span>
                </div>
            );
        }
        return <span className="text-zinc-500">N/A</span>;
    }

    return (
        <div className="bg-[#2D2D2D] p-6 rounded-xl border border-zinc-700 font-sans">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 mb-5 border-b border-zinc-700">
                <div className="flex items-center gap-4">
                    <Link href="/stock" passHref>
                        <Button variant="outline" size="icon" className="bg-[#1C1C1C] border-zinc-700 text-white hover:bg-zinc-700 cursor-pointer">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-white text-3xl font-bold">Histórico</h1>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                    <Input
                        type="search"
                        placeholder="Buscar no histórico..."
                        className="pl-10 w-full bg-[#1C1C1C] text-white border-zinc-600 placeholder:text-zinc-500 rounded-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading && <div className="text-center text-white py-8"><Loader2 className="h-10 w-10 animate-spin text-white mx-auto" /><p className="mt-3">Carregando...</p></div>}
            {error && <div className="text-center text-red-500 bg-red-900/20 p-3 rounded-md">{error}</div>}

            {!loading && !error && filteredLogs.length > 0 && (
                <div className="hidden md:grid md:grid-cols-12 items-center gap-x-6 px-3 pb-2 mb-2 text-xs font-semibold text-zinc-400 uppercase">
                    <div className="col-span-2">Data e Hora</div>
                    <div className="col-span-2">Produto</div>
                    <div className="col-span-2">Usuário</div>
                    <div className="col-span-2">Ação</div>
                    <div className="col-span-4">Detalhes / Alteração</div>
                </div>
            )}

            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-2">
                {!loading && filteredLogs.map((log) => (
                    <div
                        key={log.id}
                        className="grid grid-cols-1 md:grid-cols-12 items-center gap-x-6 bg-[#1C1C1C] p-3 rounded-lg text-sm"
                    >
                        <div className="col-span-2 text-zinc-400">
                            {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                        </div>
                        <div className="col-span-2 text-white font-medium truncate">{log.product_name || 'N/A'}</div>
                        <div className="col-span-2 text-zinc-300 truncate">{log.user_email}</div>
                        <div className="col-span-2 text-zinc-300 truncate">{log.action}</div>
                        <div className="col-span-4 text-zinc-300 truncate">{formatChange(log)}</div>
                    </div>
                ))}
                 {!loading && filteredLogs.length === 0 && !error && (
                    <div className="text-center text-zinc-500 py-10">Nenhum registro encontrado.</div>
                )}
            </div>
        </div>
    );
}