"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, UserPlus, Lock } from "lucide-react"
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { createUserAction } from "@/app/actions/create-user"

interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: string | null;
}

interface UserManageProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    currentUserProfile: UserProfile | null;
}

export function UserManage({ isOpen, onOpenChange, currentUserProfile }: UserManageProps) {
    const supabase = createClientComponentClient();
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Funcionario' });
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    const fetchAllUsers = async () => {
        if (!isOpen) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('profiles').select('*').order('name');
            if (error) throw error;
            setAllUsers(data || []);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar lista de usuários.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchAllUsers();
        }
    }, [isOpen]);

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            if (userId === currentUserProfile?.id) {
                toast.error("Você não pode alterar seu próprio cargo aqui.");
                return;
            }
            const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
            if (error) throw error;
            setAllUsers(users => users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            toast.success("Cargo atualizado com sucesso.");
        } catch (error) {
            toast.error("Erro ao atualizar cargo.");
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.email || !newUser.password || !newUser.name) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }
        setIsCreatingUser(true);
        try {
            await createUserAction({
                email: newUser.email,
                password: newUser.password,
                name: newUser.name,
                role: newUser.role
            });

            toast.success(`Usuário ${newUser.name} criado com sucesso!`);
            setIsCreateUserOpen(false);
            setNewUser({ name: '', email: '', password: '', role: 'Funcionario' });
            fetchAllUsers();

        } catch (error: any) {
            toast.error(error.message || "Erro ao criar usuário.");
        } finally {
            setIsCreatingUser(false);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl w-[95%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader className="flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle>Gerenciar Equipe</DialogTitle>
                            <DialogDescription className="text-zinc-400">Crie contas e defina os cargos.</DialogDescription>
                        </div>
                        <Button onClick={() => setIsCreateUserOpen(true)} className="bg-white text-black hover:bg-zinc-200 cursor-pointer gap-2">
                            <UserPlus className="h-4 w-4" />
                            Adicionar Funcionário
                        </Button>
                    </DialogHeader>

                    <div className="py-4 max-h-[60vh] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b-zinc-700 hover:bg-zinc-900/50">
                                        <TableHead className="text-zinc-300">Nome</TableHead>
                                        <TableHead className="text-zinc-300">Email</TableHead>
                                        <TableHead className="text-zinc-300 text-center">Cargo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allUsers.map((u) => (
                                        <TableRow key={u.id} className="border-b-zinc-800 hover:bg-zinc-800/50">
                                            <TableCell className="font-medium flex items-center gap-2">
                                                {u.name}
                                                {u.role === 'Administrador' && (
                                                    <span title="Administrador" className="cursor-help flex items-center justify-center">
                                                        <Lock className="h-3 w-3 text-yellow-500" />
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-zinc-400">{u.email}</TableCell>
                                            <TableCell className="text-center">
                                                <Select
                                                    value={u.role || 'Funcionario'}
                                                    onValueChange={(newRole) => handleRoleChange(u.id, newRole)}
                                                    disabled={u.id === currentUserProfile?.id}
                                                >
                                                    <SelectTrigger className={cn(
                                                        "w-36 mx-auto border-zinc-700 transition-colors",
                                                        u.role === 'Administrador' ? "bg-yellow-900/20 text-yellow-500 border-yellow-900/50" :
                                                            u.role === 'Gerente' ? "bg-blue-900/20 text-blue-400 border-blue-900/50" :
                                                                "bg-zinc-800"
                                                    )}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                                                        <SelectItem value="Gerente" className="cursor-pointer">Gerente</SelectItem>
                                                        <SelectItem value="Funcionario" className="cursor-pointer">Funcionário</SelectItem>
                                                        {u.role === 'Administrador' && <SelectItem value="Administrador" disabled className="opacity-50">Administrador</SelectItem>}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="hover:bg-zinc-800 border-zinc-700 bg-transparent cursor-pointer">Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle>Novo Funcionário</DialogTitle>
                        <DialogDescription className="text-zinc-400">Crie uma conta de acesso para um novo membro da equipe.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="new-name">Nome Completo</Label>
                            <Input id="new-name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="bg-zinc-800 border-zinc-700" placeholder="Ex: Ana Silva" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="new-email">Email de Acesso</Label>
                            <Input id="new-email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="bg-zinc-800 border-zinc-700" placeholder="ana@atitudepapelaria.com" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="new-password">Senha Inicial</Label>
                            <Input id="new-password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="bg-zinc-800 border-zinc-700" placeholder="Mínimo 6 caracteres" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="new-role">Cargo Inicial</Label>
                            <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                                <SelectTrigger id="new-role" className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                                    <SelectItem value="Funcionario" className="cursor-pointer">Funcionário</SelectItem>
                                    <SelectItem value="Gerente" className="cursor-pointer">Gerente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreateUserOpen(false)} className="hover:bg-zinc-800 cursor-pointer">Cancelar</Button>
                        <Button onClick={handleCreateUser} disabled={isCreatingUser} className="bg-white text-black hover:bg-zinc-200 cursor-pointer">
                            {isCreatingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Conta"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}