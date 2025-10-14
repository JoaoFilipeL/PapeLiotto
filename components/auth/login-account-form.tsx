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
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@radix-ui/react-label';

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

export function LoginAccountForm() {
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
  const [isForgotPassOpen, setIsForgotPassOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);
  const [forgotPassMessage, setForgotPassMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
        setForgotPassMessage({ type: 'error', text: 'Por favor, digite seu e-mail.' });
        return;
    }
    setIsSubmittingForgot(true);
    setForgotPassMessage(null);

    const supabase = createClientComponentClient();
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/update-password`,
    });

    setIsSubmittingForgot(false);
    if (error) {
        setForgotPassMessage({ type: 'error', text: 'Erro ao enviar o e-mail. Tente novamente.' });
        console.error("Erro na redefinição de senha:", error);
    } else {
        setForgotPassMessage({ type: 'success', text: 'Se existir uma conta com este e-mail, um link para redefinição de senha foi enviado.' });
    }
  };

  return (
    <div className='flex flex-col justify-center items-center space-y-4 w-full'>
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
                      className="absolute right-0 top-0 h-full px-3 py-1 text-white hover:bg-zinc-700"
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
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsForgotPassOpen(true);
              setForgotPassMessage(null);
              setForgotEmail('');
            }}
            className="text-sm text-right text-zinc-400 hover:underline"
          >
            Esqueceu sua senha?
          </a>
          <Button type='submit' className='w-full mt-4 bg-white text-black hover:bg-gray-200 rounded-md shadow-lg'>Entrar</Button>
        </form>
      </Form>

      <Dialog open={isForgotPassOpen} onOpenChange={setIsForgotPassOpen}>
        <DialogContent className="bg-zinc-900 text-white border-zinc-700">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Digite seu e-mail abaixo. Se ele estiver cadastrado, enviaremos um link para você redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-zinc-300">E-mail</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="seu.email@exemplo.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            {forgotPassMessage && (
              <p className={`${forgotPassMessage.type === 'success' ? 'text-green-400' : 'text-red-500'} text-sm`}>
                {forgotPassMessage.text}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsForgotPassOpen(false)} className="bg-transparent border-zinc-700 hover:bg-zinc-800">Cancelar</Button>
            <Button onClick={handleForgotPassword} disabled={isSubmittingForgot} className="bg-white text-black hover:bg-gray-200">
              {isSubmittingForgot && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}