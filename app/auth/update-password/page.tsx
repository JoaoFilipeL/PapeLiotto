'use client';

import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const formSchema = z.object({
  password: z.string().min(6, { message: 'A nova senha deve ter pelo menos 6 caracteres.' }),
});

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
    },
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidToken(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setError(null);
    setSuccessMessage(null);
    
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setError('Não foi possível redefinir a senha. O link pode ter expirado. Por favor, tente novamente.');
      console.error("Erro ao atualizar senha:", error);
    } else {
      setSuccessMessage('Senha redefinida com sucesso! Você será redirecionado para o login em breve.');
      setTimeout(() => {
        router.push('/');
      }, 3000);
    }
  };

  if (!isValidToken) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-900">
            <Card className="w-[350px] bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Verificando link...</CardTitle>
                </CardHeader>
                <CardContent>
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-zinc-400" />
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <Card className="w-[350px] bg-zinc-800 border-zinc-700 text-white">
            <CardHeader>
                <CardTitle>Redefinir Senha</CardTitle>
                <CardDescription className="text-zinc-400">Digite sua nova senha abaixo.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nova Senha</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="password"
                                            placeholder="********" 
                                            {...field}
                                            className="bg-zinc-700 border-zinc-600 placeholder:text-zinc-500"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        {successMessage && <p className="text-sm text-green-400">{successMessage}</p>}
                        <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Salvar Nova Senha
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}