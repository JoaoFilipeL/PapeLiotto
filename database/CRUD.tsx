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
  const itens = await localStorage.getItem("list");
  const itensArray: Item[] = itens ? JSON.parse(itens) : [];

  const nextId = itensArray.length > 0 ? Math.max(...itensArray.map(i => i.id)) + 1 : 1;
  const newItem: Item = { ...item, id: nextId };

  localStorage.setItem("list", JSON.stringify([...itensArray, newItem]));
  dispatchStorageEvent();
}

export async function ReadItem(): Promise<Item[]> {
  const itens = await localStorage.getItem("list");
  return itens ? JSON.parse(itens) : [];
}

export async function UpdateItem(item: Item) {
  const itens = await localStorage.getItem("list");
  const itensArray: Item[] = itens ? JSON.parse(itens) : [];

  const novaLista = itensArray.map((x) => x.id === item.id ? item : x);

  localStorage.setItem("list", JSON.stringify(novaLista));
  dispatchStorageEvent();
} 

export async function DeleteItem(id: number) {
  const itens = await localStorage.getItem("list");
  const itensArray: Item[] = itens ? JSON.parse(itens) : [];

  const novaLista = itensArray.filter((x) => x.id !== id);

  localStorage.setItem("list", JSON.stringify(novaLista));
  dispatchStorageEvent();
}
