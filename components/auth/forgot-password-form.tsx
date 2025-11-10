'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function ForgotPasswordForm() {
  const [isForgotPassOpen, setIsForgotPassOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast.error('Por favor, digite seu e-mail.');
      return;
    }

    setIsSubmittingForgot(true);

    try {
      const supabase = createClientComponentClient();
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) {
        toast.error('Erro ao enviar o e-mail. Tente novamente.');
        console.error("Erro na redefinição de senha:", error);
      } else {
        toast.success('Será enviado um link para redefinir sua senha.');
      }
    } catch (error) {
      toast.error('Ocorreu um erro inesperado.');
    } finally {
      setIsSubmittingForgot(false);
      setIsForgotPassOpen(false);
    }
  };

  const openPopover = () => {
    setIsForgotPassOpen(true);
    setForgotEmail('');
  }

  return (
    <Popover open={isForgotPassOpen} onOpenChange={setIsForgotPassOpen}>
      <PopoverTrigger asChild>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openPopover();
          }}
          className="text-sm text-zinc-400 hover:underline self-end -mt-2 cursor-pointer"
        >
          Esqueceu sua senha?
        </a>
      </PopoverTrigger>
      <PopoverContent className="bg-zinc-900 text-white border-zinc-700 w-96" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-bold leading-none">Recuperar Senha</h4>
            <p className="text-sm text-zinc-400">
              Digite seu e-mail abaixo para redefinir sua senha.
            </p>
          </div>
          <div className="space-y-4 py-2">
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
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsForgotPassOpen(false)}
              className="bg-transparent border-zinc-700 hover:bg-zinc-800 cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handleForgotPassword}
              disabled={isSubmittingForgot}
              className="bg-transparent border-zinc-700 hover:bg-zinc-800 cursor-pointer"
            >
              {isSubmittingForgot && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Link
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}