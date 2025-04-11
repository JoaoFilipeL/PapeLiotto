import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Plus } from "lucide-react"
import { Label } from "./ui/label"
import { useState, useEffect } from "react"
import { CreateItem, Item } from "@/database/CRUD"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue
} from "@/components/ui/select"

interface DialogAddItemProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

export default function DialogAddItem({ isOpen, setIsOpen }: DialogAddItemProps) {

  const [item, setItem] = useState<Item>({
    name: '',
    code: 0,
    category: '',
    price: 0,
    costprice: 0,
    description: '',
    quantity: 0,
    minStock: 0
  })


  useEffect(() => {
    if (isOpen) {
      setItem({
        name: '',
        code: 0,
        category: '',
        price: 0,
        costprice: 0,
        description: '',
        quantity: 0,
        minStock: 0
      });
    }
  }, [isOpen]);

  function handleCreateItem() {
    if (item.name.trim() === '' || item.description.trim() === '' || item.quantity === 0 || item.minStock === 0) {
      return;
    }

    CreateItem(item)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>

        <DialogHeader>
          <DialogTitle>Adicionar Produto:</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col space-y-4">
          <div className="flex flex-col space-y-2">
            <Label className="font-bold">Nome do produto</Label>
            <Input
              value={item.name}
              onChange={(e) => setItem((prevItem) => ({ ...prevItem, name: e.target.value }))}
              placeholder="Nome do produto"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Label className="font-bold">Código do produto</Label>
            <Input
              type="number"
              value={item.code === 0 ? '' : item.code}
              onChange={(e) => setItem((prevItem) => ({ ...prevItem, code: Number(e.target.value) }))}
              placeholder="Código do produto"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Label className="font-bold">Categoria</Label>
            <Select
              value={item.category}
              onValueChange={(value) => setItem((prevItem) => ({ ...prevItem, category: value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Categoria</SelectLabel>
                  <SelectItem value="Informática">Informática</SelectItem>
                  <SelectItem value="Cadernos">Cadernos</SelectItem>
                  <SelectItem value="Impressoras">Impressoras</SelectItem>
                  <SelectItem value="Escritório">Escritório</SelectItem>
                  <SelectItem value="Escolar">Escolar</SelectItem>
                  <SelectItem value="Escrita">Escrita</SelectItem>
                  <SelectItem value="Papéis">Papéis</SelectItem>
                  <SelectItem value="Limpeza">Limpeza</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col space-y-2">
            <Label className="font-bold">Preço de venda</Label>
            <Input
              type="number"
              value={item.price === 0 ? '' : item.price}
              onChange={(e) => setItem((prevItem) => ({ ...prevItem, price: Number(e.target.value) }))}
              placeholder="R$ 0,00"
              className="text-left"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Label className="font-bold">Preço de custo</Label>
            <Input
              type="number"
              value={item.costprice === 0 ? '' : item.costprice}
              onChange={(e) => setItem((prevItem) => ({ ...prevItem, costprice: Number(e.target.value) }))}
              placeholder="R$ 0,00"
              className="text-left"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Label className="font-bold">Quantidade</Label>
            <Input
              type="number"
              value={item.quantity === 0 ? '' : item.quantity}
              onChange={(e) => setItem((prevItem) => ({ ...prevItem, quantity: Number(e.target.value) }))}
              placeholder="Quantidade"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Label className="font-bold">Quantidade Mínima</Label>
            <Input
              type="number"
              value={item.minStock === 0 ? '' : item.minStock}
              onChange={(e) => setItem((prevItem) => ({ ...prevItem, minStock: Number(e.target.value) }))}
              placeholder="Quantidade mínima"
            />
          </div>
          <div className="flex flex-col space-y-2">
            <Label className="font-bold">Descrição do produto</Label>
            <Input
              value={item.description}
              onChange={(e) => setItem((prevItem) => ({ ...prevItem, description: e.target.value }))}
              placeholder="Descrição do produto"
            />
          </div>
        </div>

        <Button onClick={handleCreateItem} className="bg-black hover:bg-gray-800 transition-all duration-300">
          <Plus /> Adicionar Produto
        </Button>

      </DialogContent>
    </Dialog>
  )
}
