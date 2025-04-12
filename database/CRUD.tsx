import { supabase } from "@/lib/supabaseClient"

export interface Item {
  id: number
  name: string
  code: number
  category: string
  price: number
  costprice: number
  quantity: number
  description: string
  minStock: number
}

const dispatchStorageEvent = () => {
  window.dispatchEvent(new Event("localStorageUpdated"));
};

export async function CreateItem(item: Omit<Item, "id">) {

  const {error} = await supabase.from('Produtos').insert([item])

  if (error) return;

  const itens = await localStorage.getItem("list");
  const itensArray: Item[] = itens ? JSON.parse(itens) : [];

  const nextId = itensArray.length > 0 ? Math.max(...itensArray.map(i => i.id)) + 1 : 1;
  const newItem: Item = { ...item, id: nextId };

  localStorage.setItem("list", JSON.stringify([...itensArray, newItem]));
  dispatchStorageEvent();


}

export async function ReadItem(): Promise<Item[]> {
  const {data} = await supabase.from('Produtos').select('*')
  return data ? data : [];
}

export async function UpdateItem(item: Item) {

  const {error} = await supabase.from('Produtos').update(item).eq('id', item.id)

  if (error) return;

  const itens = await localStorage.getItem("list");
  const itensArray: Item[] = itens ? JSON.parse(itens) : [];

  const novaLista = itensArray.map((x) => x.id === item.id ? item : x);

  localStorage.setItem("list", JSON.stringify(novaLista));
  dispatchStorageEvent();
} 

export async function DeleteItem(id: number) {

  const {error} = await supabase.from('Produtos').delete().eq('id', id)

  if (error) return;

  const itens = await localStorage.getItem("list");
  const itensArray: Item[] = itens ? JSON.parse(itens) : [];

  const novaLista = itensArray.filter((x) => x.id !== id);

  localStorage.setItem("list", JSON.stringify(novaLista));
  dispatchStorageEvent();
}
