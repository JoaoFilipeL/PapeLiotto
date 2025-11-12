import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';
import { LoginAccountForm } from '@/components/auth/login-account-form';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react'; 

export default async function Home() {
  let loggedIn = false;
  try {
    const supabase = createServerComponentClient({ cookies }); 
    const { data: { session } } = await supabase.auth.getSession();

    if (session) loggedIn = true;
  } catch (error) {
    console.error('Error in Home component:', error);
  } finally {
    if (loggedIn) redirect('/dashboard', RedirectType.replace);
  }

  return (
    <div className='flex items-center justify-center min-h-screen w-full bg-black p-4 font-inter'>
      <div className='flex flex-col md:flex-row items-center justify-center p-8 bg-zinc-900 w-full max-w-5xl rounded-xl shadow-2xl space-y-8 md:space-y-0 md:space-x-8'>
        <div className='flex flex-col items-center justify-center p-8 md:w-1/2'>
          <Package size={280} className="text-white" /> 
        </div>
        <div className='flex flex-col items-center justify-center p-8 md:w-1/2'>
          <div className='text-center md:text-left w-full mb-8'>
            <h1 className="text-5xl font-bold text-white mb-2">Atitude Papelaria</h1>
          </div>
          <Card className="bg-zinc-900 border-0 w-full shadow-none">
            <CardContent className="p-0">
              <LoginAccountForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}