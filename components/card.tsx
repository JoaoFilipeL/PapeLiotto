'use client'

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Plus } from "lucide-react"
import DialogUpdateItem from "./dialogUpdateItem"

interface StockCardProps {
    id: number
    name: string
    code: number
    category: string
    price: number
    costprice: number
    quantity: number
    description: string
    minStock: number
    lastUpdated: string
}

export default function StockCard({
    id,
    name,
    code,
    category,
    price,
    costprice,
    quantity,
    description,
    minStock,
    lastUpdated,
}: StockCardProps) {
    const [showModal, setShowModal] = useState(false)

    const stockStatus = quantity <= minStock ? "Baixo" : "Normal"

    const handleCardClick = () => {
        setShowModal(true)
    }

    return (
        <>
            <Card
                className="w-full max-w-xs bg-black text-white rounded-lg shadow-lg cursor-pointer"
                onClick={handleCardClick}
            >
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-semibold">{name}</h3>
                            <p className="text-sm">{code}</p>
                        </div>
                        <span
                            className={`px-2 py-1 text-xs font-medium rounded ${stockStatus === "Baixo" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
                        >
                            {stockStatus}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div className="col-span-2">
                            <p className="text-xl font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)}</p>
                        </div>
                        <div>
                            <p className="text-sm">Quantidade</p>
                            <p className="font-medium">{quantity} em estoque</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="text-sm">
                            <p className="text-sm">Ultima atualização</p>
                            <p className="font-medium">{lastUpdated}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {showModal && (
                <DialogUpdateItem
                    isOpen={showModal}
                    setIsOpen={setShowModal}
                    id={id}
                    name={name}
                    code={code}
                    category={category}
                    price={price}
                    costprice={costprice}
                    quantity={quantity}
                    description={description}
                    minStock={minStock}
                    lastUpdated={lastUpdated}
                />
            )}

        </>
    )
}
