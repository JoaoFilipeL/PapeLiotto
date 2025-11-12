import { User } from '@supabase/auth-helpers-nextjs';

export interface StockItem {
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

export interface Product {
    id: string;
    name: string;
    price: number;
    quantity: number; 
}

export interface UserProfile {
    role: string | null;
}

export interface CurrentUser extends User {}

export const statusColors: Record<StockItem['status'], string> = {
    ok: "bg-green-600 text-white hover:bg-green-700",
    baixo: "bg-yellow-600 text-white hover:bg-yellow-700",
    crítico: "bg-red-600 text-white hover:bg-red-700",
}