"use client"
import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { User as SupabaseUser } from "@supabase/auth-helpers-nextjs"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, Camera, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    bio: string | null;
    avatar_url: string | null;
    role: string | null;
}

export default function User() {
    const router = useRouter();
    const supabase = createClientComponentClient();

    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);

    const avatarFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
        }
    }, [imagePreview]);

    const formatPhoneNumber = (value: string) => {
        if (!value) return "";
        const numericValue = value.replace(/\D/g, "");
        if (numericValue.length <= 2) return `(${numericValue}`;
        if (numericValue.length <= 7) return `(${numericValue.slice(0, 2)}) ${numericValue.slice(2)}`;
        return `(${numericValue.slice(0, 2)}) ${numericValue.slice(2, 7)}-${numericValue.slice(7, 11)}`;
    };

    const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formattedValue = formatPhoneNumber(e.target.value);
        if (userProfile) {
            setUserProfile({ ...userProfile, phone: formattedValue });
        }
    };

    const fetchUserAndProfile = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) setIsLoading(true);
        setError(null);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            setUser(authUser);

            if (authUser) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, name, email, phone, bio, avatar_url, role')
                    .eq('id', authUser.id)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') throw profileError;

                const profile = {
                    id: profileData?.id || authUser.id,
                    name: profileData?.name || authUser.email?.split('@')[0] || "Usuário",
                    email: profileData?.email || authUser.email || "N/A",
                    phone: profileData?.phone ? formatPhoneNumber(profileData.phone) : null,
                    bio: profileData?.bio,
                    avatar_url: profileData?.avatar_url,
                    role: profileData?.role || 'Funcionario'
                };
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
        } catch (err: any) {
            console.error("❌ Erro ao buscar perfil:", err);
            setError(err.message || "Erro ao carregar informações do usuário.");
        } finally {
            if (isInitialLoad) setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchUserAndProfile(true);
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
            if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
                fetchUserAndProfile();
            }
        });
        return () => { authListener.subscription.unsubscribe(); };
    }, [supabase, fetchUserAndProfile]);

    const openSettings = async () => {
        await fetchUserAndProfile();
        setIsSettingsOpen(true);
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (userProfile) {
            setUserProfile({ ...userProfile, [name]: value });
        }
    };

    const handleSaveAllChanges = async () => {
        if (!user || !userProfile) return;

        setIsSubmitting(true);
        setError(null);

        try {
            if (imageFile) {
                setIsUploadingAvatar(true);
                const fileExt = imageFile.name.split('.').pop();
                const filePath = `${user.id}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, imageFile, {
                        upsert: true,
                        contentType: imageFile.type,
                        cacheControl: '3600'
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);
                
                userProfile.avatar_url = `${publicUrl}?t=${new Date().getTime()}`;
            }

            const { error: updateError } = await supabase.from('profiles').update({
                name: userProfile.name,
                phone: userProfile.phone ? userProfile.phone.replace(/\D/g, '') : null,
                bio: userProfile.bio,
                avatar_url: userProfile.avatar_url
            }).eq('id', user.id);

            if (updateError) throw updateError;

            toast.success("Perfil atualizado!");
            fetchUserAndProfile();
            setIsSettingsOpen(false);
            setImageFile(null);
            setImagePreview(null);

        } catch (err: any) {
            console.error("Erro ao salvar perfil:", err);
            setError(err.message);
            toast.error("Erro ao atualizar perfil.");
        } finally {
            setIsSubmitting(false);
            setIsUploadingAvatar(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];

            if (file.size > 5 * 1024 * 1024) { // 5MB
                toast.error("Arquivo muito grande. Máximo de 5MB.");
                return;
            }

            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }

            setImagePreview(URL.createObjectURL(file));
            setImageFile(file);
        }
    };

    const triggerAvatarUpload = () => avatarFileInputRef.current?.click();

    const handleRemoveAvatar = async () => {
        if (!user || !userProfile) return;
        setIsRemovingAvatar(true);
        setError(null);
        try {
            const urlParts = userProfile.avatar_url?.split('/');
            if (urlParts) {
                const fileNameWithQuery = urlParts[urlParts.length - 1];
                const fileName = fileNameWithQuery.split('?')[0];
                if (fileName) {
                     await supabase.storage.from('avatars').remove([fileName]);
                }
            }

            await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
            setUserProfile({ ...userProfile, avatar_url: null });
            
            setImageFile(null);
            setImagePreview(null);
            
            toast.success("Foto removida.");
        } catch (err: any) {
            console.error("Erro ao remover avatar:", err);
            setError(err.message);
        } finally {
            setIsRemovingAvatar(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const handleModalClose = (open: boolean) => {
        if (!open) {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
            setImagePreview(null);
            setImageFile(null);
            setError(null);
        }
        setIsSettingsOpen(open);
    }

    if (isLoading) {
        return <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 animate-pulse" />;
    }

    if (!user || !userProfile) {
        return null;
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-zinc-700 hover:bg-zinc-800 cursor-pointer">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={userProfile.avatar_url || undefined} alt="Avatar" />
                            <AvatarFallback className="bg-zinc-700 text-white">{userProfile.name?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-zinc-900 text-white border-zinc-700" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none truncate">{userProfile.name}</p>
                            <p className="text-xs leading-none text-zinc-400">{userProfile.role}</p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-700" />
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={openSettings} className="focus:bg-zinc-700 focus:text-white cursor-pointer">Perfil</DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator className="bg-zinc-700" />
                    <DropdownMenuItem onClick={handleSignOut} disabled={isSubmitting} className="focus:bg-zinc-700 focus:text-white cursor-pointer text-red-400 focus:text-red-400">
                        Sair
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isSettingsOpen} onOpenChange={handleModalClose}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950 text-zinc-50 border-zinc-800">
                    <DialogHeader>
                        <DialogTitle>Seu Perfil</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Gerencie suas informações pessoais.
                        </DialogDescription>
                    </DialogHeader>
                    {userProfile && (
                        <div className="grid gap-4 py-4">
                            {error && (
                                <div className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-md border border-red-500/20">
                                    {error}
                                </div>
                            )}
                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    <Avatar className="h-20 w-20 border-2 border-zinc-800 bg-zinc-900 transition-all group-hover:border-zinc-700">
                                        <AvatarImage
                                            src={imagePreview || userProfile.avatar_url || undefined}
                                            alt={userProfile.name}
                                            className="object-cover"
                                        />
                                        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-2xl font-medium">
                                            {userProfile.name?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div
                                        className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
                                        onClick={!isUploadingAvatar ? triggerAvatarUpload : undefined}
                                    >
                                        {isUploadingAvatar ? (
                                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                                        ) : (
                                            <Camera className="h-6 w-6 text-white" />
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        ref={avatarFileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept="image/png, image/jpeg, image/webp"
                                        disabled={isUploadingAvatar}
                                    />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">Foto de Perfil</p>
                                    <p className="text-xs text-zinc-400">
                                        Clique na imagem para alterar.
                                    </p>
                                </div>
                                {(userProfile.avatar_url || imagePreview) && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 border-zinc-800 bg-zinc-900 hover:bg-red-900/20 hover:text-red-500 hover:border-red-900/50 transition-colors cursor-pointer"
                                        onClick={handleRemoveAvatar}
                                        disabled={isRemovingAvatar || isUploadingAvatar}
                                    >
                                        {isRemovingAvatar ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </Button>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="name" className="text-zinc-400">Nome</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={userProfile.name}
                                    onChange={handleInputChange}
                                    className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email" className="text-zinc-400">Email</Label>
                                <Input
                                    id="email"
                                    value={userProfile.email}
                                    disabled
                                    className="bg-zinc-900/50 border-zinc-800 text-zinc-500 cursor-not-allowed"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="role" className="text-zinc-400">Cargo</Label>
                                    <Input
                                        id="role"
                                        value={userProfile.role || ''}
                                        disabled
                                        className="bg-zinc-900/50 border-zinc-800 text-zinc-500 cursor-not-allowed capitalize"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phone" className="text-zinc-400">Telefone</Label>
                                    <Input
                                        id="phone"
                                        name="phone"
                                        value={userProfile.phone || ''}
                                        onChange={handlePhoneInputChange}
                                        placeholder="(00) 00000-0000"
                                        className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => handleModalClose(false)}
                            className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleSaveAllChanges}
                            disabled={isSubmitting || isUploadingAvatar}
                            className="cursor-pointer text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        >
                            {isSubmitting || isUploadingAvatar ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                "Salvar Alterações"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}