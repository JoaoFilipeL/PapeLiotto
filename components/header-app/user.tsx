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
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Camera, Trash2, Users } from "lucide-react"
import Cropper from 'react-easy-crop'
import { Area } from 'react-easy-crop'
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    bio: string | null;
    avatar_url: string | null;
    role: string | null;
}

const createImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const image = new Image(); image.addEventListener('load', () => resolve(image)); image.addEventListener('error', (error) => reject(error)); image.setAttribute('crossOrigin', 'anonymous'); image.src = url });
function getRadianAngle(degreeValue: number) { return (degreeValue * Math.PI) / 180 }
function rotateSize(width: number, height: number, rotation: number) { const rotRad = getRadianAngle(rotation); return { width: Math.abs(width * Math.cos(rotRad)) + Math.abs(height * Math.sin(rotRad)), height: Math.abs(width * Math.sin(rotRad)) + Math.abs(height * Math.cos(rotRad)), } }
async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation = 0): Promise<Blob | null> { const image = await createImage(imageSrc); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) { return null } const rotRad = getRadianAngle(rotation); const { width: imageWidth, height: imageHeight } = image; const { width: bBoxWidth, height: bBoxHeight } = rotateSize(imageWidth, imageHeight, rotation); canvas.width = bBoxWidth; canvas.height = bBoxHeight; ctx.translate(bBoxWidth / 2, bBoxHeight / 2); ctx.rotate(rotRad); ctx.translate(-imageWidth / 2, -imageHeight / 2); ctx.drawImage(image, 0, 0); const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height); canvas.width = pixelCrop.width; canvas.height = pixelCrop.height; ctx.putImageData(data, 0, 0); return new Promise((resolve) => { canvas.toBlob((blob) => { resolve(blob) }, 'image/jpeg', 0.95) }) }

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

    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isCropperOpen, setIsCropperOpen] = useState(false);

    const avatarFileInputRef = useRef<HTMLInputElement>(null);

    const [isManageUsersOpen, setManageUsersOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [manageUsersLoading, setManageUsersLoading] = useState(false);

    const fetchAllUsers = async () => {
        if (userProfile?.role !== 'Gerente') return;
        setManageUsersLoading(true);
        try {
            const { data, error } = await supabase.from('profiles').select('*');
            if (error) throw error;
            setAllUsers(data || []);
        } catch (error) {
            console.error("Erro ao buscar usuários:", error);
        } finally {
            setManageUsersLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
            if (error) throw error;
            setAllUsers(users => users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            console.error("Erro ao alterar o cargo:", error);
        }
    };

    const handleManageUsersOpenChange = (isOpen: boolean) => {
        setManageUsersOpen(isOpen);
        if (!isOpen) {
            fetchUserAndProfile();
        }
    };
    
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
        if(isInitialLoad) setIsLoading(true);
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
                    role: profileData?.role
                };
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
        } catch (err: any) {
            setError(err.message || "Erro ao carregar informações do usuário.");
        } finally {
            if(isInitialLoad) setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchUserAndProfile(true);
        let authListener: any;

        if (!isManageUsersOpen && !isSettingsOpen) {
            const { data } = supabase.auth.onAuthStateChange((event) => {
                if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
                    fetchUserAndProfile();
                }
            });
            authListener = data;
        }

        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, [supabase, fetchUserAndProfile, isManageUsersOpen, isSettingsOpen]);
    
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

    const handleSaveProfile = async () => {
        if (!user || !userProfile) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const { error: updateError } = await supabase.from('profiles').update({
                name: userProfile.name,
                phone: userProfile.phone ? userProfile.phone.replace(/\D/g, '') : null,
                bio: userProfile.bio,
            }).eq('id', user.id);
            if (updateError) throw updateError;
            
            setIsSettingsOpen(false);
            fetchUserAndProfile();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0) { const reader = new FileReader(); reader.addEventListener('load', () => { setImageSrc(reader.result as string); setIsCropperOpen(true); }); reader.readAsDataURL(e.target.files[0]); } };
    const triggerAvatarUpload = () => avatarFileInputRef.current?.click();
    const onCropComplete = useCallback((croppedAreaPixels: Area) => { setCroppedAreaPixels(croppedAreaPixels); }, []);

    const handleSaveCroppedAvatar = async () => {
        if (!user || !imageSrc || !croppedAreaPixels) return;
        setIsUploadingAvatar(true);
        setError(null);
        try {
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
            if (!croppedImageBlob) throw new Error("Não foi possível cortar a imagem.");
            const filePath = `${user.id}.${croppedImageBlob.type.split('/')[1]}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, croppedImageBlob, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
            const finalAvatarUrl = `${publicUrl}?t=${new Date().getTime()}`;
            const { error: updateProfileError } = await supabase.from('profiles').update({ avatar_url: finalAvatarUrl }).eq('id', user.id);
            if (updateProfileError) throw updateProfileError;
            
            setIsCropperOpen(false);
            setImageSrc(null);
            fetchUserAndProfile();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleRemoveAvatar = async () => {
        if (!user || !userProfile || !userProfile.avatar_url) {
            return;
        }

        setIsRemovingAvatar(true);
        setError(null);
        try {
            const urlParts = userProfile.avatar_url.split('/');
            const fileName = urlParts[urlParts.length - 1].split('?')[0];
            const { error: deleteError } = await supabase.storage.from('avatars').remove([fileName]);
            if (deleteError) throw deleteError;

            const { error: updateProfileError } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
            if (updateProfileError) throw updateProfileError;
            fetchUserAndProfile();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsRemovingAvatar(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (isLoading) {
        return <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700" />;
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
                            <p className="text-sm font-medium leading-none">{userProfile.name}</p>
                            <p className="text-xs leading-none text-zinc-400">{userProfile.role}</p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-700" />
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={openSettings} className="focus:bg-zinc-700 focus:text-white cursor-pointer">Perfil</DropdownMenuItem>
                        {userProfile.role === 'Gerente' && (
                             <DropdownMenuItem onClick={() => { fetchAllUsers(); setManageUsersOpen(true); }} className="focus:bg-zinc-700 focus:text-white cursor-pointer">
                                Funcionários
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator className="bg-zinc-700" />
                    <DropdownMenuItem onClick={handleSignOut} disabled={isSubmitting} className="focus:bg-zinc-700 focus:text-white cursor-pointer">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sair"}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-[525px] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle className="text-white">Configurações de Perfil</DialogTitle>
                        <DialogDescription className="text-zinc-400">Gerencie suas informações de perfil.</DialogDescription>
                    </DialogHeader>
                    {userProfile && (
                        <div className="space-y-4 py-4">
                            {error && <p className="text-sm text-red-500 bg-red-900/20 p-3 rounded-md">{error}</p>}
                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    <Avatar className="h-16 w-16 border-2 border-zinc-700">
                                        <AvatarImage src={userProfile.avatar_url || undefined} alt="Avatar" />
                                        <AvatarFallback className="bg-zinc-700 text-white">{userProfile.name?.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={triggerAvatarUpload}>
                                        {isUploadingAvatar ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                                    </div>
                                    <input type="file" ref={avatarFileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-white">Foto de Perfil</h3>
                                    <p className="text-sm text-zinc-400">Clique na imagem para alterar.</p>
                                </div>
                                {userProfile.avatar_url && (
                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-zinc-800 cursor-pointer" onClick={handleRemoveAvatar} disabled={isRemovingAvatar}>
                                        {isRemovingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-2"><Label htmlFor="name" className="text-zinc-300">Nome</Label><Input id="name" name="name" value={userProfile.name} onChange={handleInputChange} className="bg-zinc-800 border-zinc-700" /></div>
                            <div className="space-y-2"><Label htmlFor="email" className="text-zinc-300">Email</Label><Input id="email" name="email" type="email" value={userProfile.email} disabled className="cursor-not-allowed bg-zinc-800 border-zinc-700 opacity-50"/></div>
                            <div className="space-y-2"><Label htmlFor="phone" className="text-zinc-300">Telefone</Label><Input id="phone" name="phone" value={userProfile.phone || ''} onChange={handlePhoneInputChange} placeholder="(DD) XXXXX-XXXX" className="bg-zinc-800 border-zinc-700"/></div>
                            <div className="space-y-2"><Label htmlFor="bio" className="text-zinc-300">Biografia</Label><Textarea id="bio" name="bio" rows={3} value={userProfile.bio || ''} onChange={handleInputChange} className="bg-zinc-800 border-zinc-700"/></div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsSettingsOpen(false)} className="hover:bg-zinc-700 cursor-pointer">Cancelar</Button>
                        <Button onClick={handleSaveProfile} disabled={isSubmitting} className="hover:bg-zinc-700 cursor-pointer">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
                <DialogContent className="sm:max-w-[600px] h-[500px] flex flex-col bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader><DialogTitle className="text-white">Cortar Imagem</DialogTitle></DialogHeader>
                    <div className="relative flex-grow min-h-0">
                        {imageSrc && <Cropper image={imageSrc} crop={crop} zoom={zoom} rotation={rotation} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={onCropComplete} cropShape="round" />}
                    </div>
                    <div className="flex flex-col gap-4 pt-4">
                        <div><Label className="text-zinc-300">Zoom</Label><Input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(parseFloat(e.target.value))} /></div>
                        <div><Label className="text-zinc-300">Rotação</Label><Input type="range" value={rotation} min={0} max={360} step={1} onChange={(e) => setRotation(parseFloat(e.target.value))} /></div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsCropperOpen(false)} disabled={isUploadingAvatar} className="hover:bg-zinc-700 cursor-pointer">Cancelar</Button>
                        <Button onClick={handleSaveCroppedAvatar} disabled={isUploadingAvatar} className="hover:bg-zinc-700 cursor-pointer">{isUploadingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Avatar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isManageUsersOpen} onOpenChange={handleManageUsersOpenChange}>
                <DialogContent className="max-w-3xl w-[90%] bg-zinc-900 text-white border-zinc-700">
                    <DialogHeader>
                        <DialogTitle className="text-white">Gerenciar Funcionários</DialogTitle>
                        <DialogDescription className="text-zinc-400">Altere o cargo dos usuários do sistema.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[60vh] overflow-y-auto">
                        {manageUsersLoading ? (
                            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b-zinc-700 hover:bg-zinc-900">
                                        <TableHead className="text-white">Nome</TableHead>
                                        <TableHead className="text-white">Email</TableHead>
                                        <TableHead className="text-white text-center">Cargo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allUsers.map((u) => (
                                        <TableRow key={u.id} className="border-b-zinc-800">
                                            <TableCell>{u.name}</TableCell>
                                            <TableCell className="text-zinc-400">{u.email}</TableCell>
                                            <TableCell className="text-center">
                                                <Select
                                                    value={u.role || 'Funcionario'}
                                                    onValueChange={(newRole) => handleRoleChange(u.id, newRole)}
                                                    disabled={u.id === userProfile?.id || u.role === 'Gerente'}
                                                >
                                                    <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                                                        <SelectItem value="Gerente">Gerente</SelectItem>
                                                        <SelectItem value="Funcionario">Funcionário</SelectItem>
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
                        <Button onClick={() => setManageUsersOpen(false)} className="hover:bg-zinc-700 cursor-pointer">Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}