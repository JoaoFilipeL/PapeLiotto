'use client';

import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { ForgotPasswordForm } from './forgot-password-form';

const formSchema = z.object({
    email: z
        .string()
        .min(1, { message: 'E-mail é obrigatório' })
        .email('E-mail inválido'),
    password: z
        .string()
        .min(1, { message: 'Senha é obrigatória' })
        .min(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
        .max(12, { message: 'Senha deve ter no máximo 12 caracteres' }),
});

export function LoginFields() {
    const router = useRouter();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoginError(null);
        try {
            const supabase = createClientComponentClient();
            const { email, password } = values;

            const { error, data: { session } } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error('Erro ao fazer login:', error.message);
                if (error.message.includes('Invalid login credentials') || error.message.includes('Email not confirmed')) {
                    setLoginError('Credenciais inválidas. Verifique seu e-mail e senha.');
                } else if (error.message.includes('User not found')) {
                    setLoginError('E-mail não cadastrado.');
                } else {
                    setLoginError('Ocorreu um erro ao fazer login. Tente novamente.');
                }
            } else if (session) {
                form.reset();
                router.refresh();
            } else {
                setLoginError('Login falhou. Verifique suas credenciais.');
            }
        } catch (error: unknown) {
            console.error('Erro inesperado ao fazer login:', error);
            if (error instanceof Error) {
                setLoginError(error.message || 'Ocorreu um erro inesperado. Tente novamente.');
            } else {
                setLoginError('Ocorreu um erro inesperado. Tente novamente.');
            }
        }
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='flex flex-col space-y-4 w-full'
            >
                {loginError && (
                    <div className="text-red-500 text-sm text-center">
                        {loginError}
                    </div>
                )}
                <FormField
                    control={form.control}
                    name='email'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-white text-sm">E-mail</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder='Digite seu e-mail'
                                    {...field}
                                    type='email'
                                    className='flex h-10 w-full rounded-md border border-input bg-zinc-800 text-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name='password'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-white text-sm">Senha</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        placeholder='***********'
                                        {...field}
                                        type={showPassword ? 'text' : 'password'}
                                        className="pr-10 bg-zinc-800 text-white placeholder:text-zinc-500 border-input"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-1 text-white hover:bg-zinc-700 cursor-pointer"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <ForgotPasswordForm />

                <Button type='submit' className='w-full mt-4 bg-white text-black hover:bg-gray-200 rounded-md shadow-lg cursor-pointer'>Entrar</Button>
            </form>
        </Form>
    );
}