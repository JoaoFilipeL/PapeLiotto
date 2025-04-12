'use client'

import { Package, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import DialogAddItem from "./dialogAddItem";

export default function Header() {
    const [isOpen, setIsOpen] = useState(false);

    return(
        <div className="flex flex-row justify-between items-center p-16">
            <div className="flex flex-row items-center gap-2">
                <h1 className="font-bold text-4xl">Produtos</h1>
            </div>
            <DialogAddItem isOpen={isOpen} setIsOpen={setIsOpen}/>
            <Button variant={'secondary'} onClick={() => setIsOpen(true)} className="bg-black hover:bg-gray-800 transition-all duration-300"><Package/>Adicionar Produto</Button>
        </div>
    )
};
