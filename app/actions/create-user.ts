'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function createUserAction(newUser: any) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: newUser.email,
    password: newUser.password,
    email_confirm: true,
    user_metadata: { name: newUser.name }
  })

  if (authError) throw new Error(authError.message)

  if (authData.user) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ name: newUser.name, role: newUser.role })
      .eq('id', authData.user.id)

    if (profileError) throw new Error("Erro ao atualizar perfil inicial.")
  }

  return { success: true }
}