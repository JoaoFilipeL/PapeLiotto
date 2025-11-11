'use client'

import { Package } from 'lucide-react';
import User from './user';

export default function Header() {
    return (
        <header className='w-full bg-black text-white p-4 flex items-center justify-between border-b border-zinc-800'>
            <div className="flex items-center gap-2">
                <Package className="h-7 w-7 text-white" />
                <span className="font-bold text-2xl">Atitude Papelaria</span>
            </div>
            <User />
        </header>
    );
}
