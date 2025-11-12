import { User } from '@supabase/auth-helpers-nextjs';

export interface Customer {
    id: string;
    name: string;
    phone?: string;
    address?: string;
}

export interface OrderItem {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
}

export type BudgetItem = OrderItem;

export interface Order {
    id: number;
    order_code: string;
    customer_id: string;
    customer_name: string;
    customer_phone?: string;
    address: string;
    order_date: string;
    payment_method: string;
    total_amount: number;
    items: OrderItem[];
    notes: string | null;
    delivery_time: string | null;
    delivery_fee: number;
    created_at: string;
    status: string;
    employee_name: string | null;
}

export interface Budget {
    id: number;
    budget_code: string;
    customer_id: string | null;
    customer_name: string | null;
    items: BudgetItem[]; 
    total_amount: number;
    created_at: string;
    valid_until: string | null;
    employee_name: string | null;
    customers?: { phone: string | null }[] | null;
}

export interface CurrentUser extends User {}