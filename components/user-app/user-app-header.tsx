'use client'
import { Package } from 'lucide-react'; 
import { UserNav } from '../common/user-nav';

export default function UserAppHeader() {
    return (
        <header className='w-full bg-black text-white p-4 flex items-center justify-between border-b border-zinc-800'>
            <div className="flex items-center gap-2">
                <Package className="h-7 w-7 text-white" /> 
                <span className="font-bold text-2xl">Atitude Papelaria</span>
            </div>
            <UserNav />
        </header>
    );
}
