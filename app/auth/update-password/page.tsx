'use client';

import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { createClientComponentClient, Session } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

function UpdatePasswordForm({ session }: { session: Session }) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = z.object({
    password: z.string()
      .min(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
      .max(12, { message: 'Senha deve ter no máximo 12 caracteres' }),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (updateError) {
      setIsSubmitting(false);
      toast.error('Erro ao atualizar a senha. Tente novamente.');
      console.error('Erro ao atualizar senha:', updateError.message);
    } else {
      const { error: signOutError } = await supabase.auth.signOut();

      setIsSubmitting(false);

      if (signOutError) {
        toast.warning('Senha atualizada, mas falha ao deslogar. Redirecionando...');
      } else {
        toast.success('Senha atualizada com sucesso! Redirecionando para o login...');
      }

      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  };

  return (
    <Card className="bg-zinc-900 border-0 w-full shadow-none">
      <CardContent className="p-0">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col space-y-4 w-full'
          >
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white text-sm">Nova Senha</FormLabel>
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
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='confirmPassword'
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white text-sm">Confirmar Nova Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder='***********'
                        {...field}
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="pr-10 bg-zinc-800 text-white placeholder:text-zinc-500 border-input"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-1 text-white hover:bg-zinc-700 cursor-pointer"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type='submit' className='w-full mt-8 bg-white text-black hover:bg-gray-200 rounded-md shadow-lg cursor-pointer' disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar senha
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


export default function UpdatePasswordPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    let eventFired = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        eventFired = true;
        setSession(session);
        setIsLoading(false);
        setError(null);
      }
    });

    const timer = setTimeout(() => {
      if (!eventFired) {
        setIsLoading(false);
        setError('Link inválido ou expirado. Por favor, solicite um novo link.');
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-black">
        <div className="flex flex-col items-center gap-4 p-8 bg-zinc-900 rounded-lg shadow-xl">
          <p className="text-white text-lg">Verificando link...</p>
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className='flex items-center justify-center min-h-screen w-full bg-black p-4 font-inter'>
        <div className='flex flex-col items-center justify-center p-8 bg-zinc-900 w-full max-w-lg rounded-xl shadow-2xl space-y-8'>
          <div className='text-center w-full mb-4'>
            <h1 className="text-3xl font-bold text-white mb-2">Redefinir Senha</h1>
            <p className="text-zinc-400">Digite sua nova senha abaixo.</p>
          </div>
          <UpdatePasswordForm session={session} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-black">
      <div className="flex flex-col items-center gap-4 p-8 bg-zinc-900 rounded-lg shadow-xl text-center">
        <p className="text-red-500 text-lg">Link inválido ou expirado</p>
        <p className="text-zinc-400">Por favor, solicite um novo link de recuperação de senha.</p>
        <Button onClick={() => window.location.href = '/'} className="mt-4 bg-white text-black hover:bg-gray-200">
          Voltar ao Login
        </Button>
      </div>
    </div>
  );
}