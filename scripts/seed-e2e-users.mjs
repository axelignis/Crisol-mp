#!/usr/bin/env node
// Seed idempotente de usuarios para Playwright E2E.
// Crea admin@test.crisol.cl (role=admin) y artisan@test.crisol.cl (role=artisan)
// con email confirmado. Reusa SUPABASE_SERVICE_ROLE / SUPABASE_SERVICE_ROLE_KEY.
//
// Uso: node scripts/seed-e2e-users.mjs
// Requiere supabase local arriba (supabase start).

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE

if (!SERVICE_KEY) {
  console.error(
    '[seed-e2e-users] Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SERVICE_ROLE) en .env.local',
  )
  process.exit(1)
}

const TEST_USERS = [
  {
    email: process.env.TEST_ADMIN_EMAIL ?? 'admin@test.crisol.cl',
    password: process.env.TEST_ADMIN_PASSWORD ?? 'TestPassword123!',
    role: 'admin',
    fullName: 'Admin Test',
  },
  {
    email: process.env.TEST_ARTISAN_EMAIL ?? 'artisan@test.crisol.cl',
    password: process.env.TEST_ARTISAN_PASSWORD ?? 'TestPassword123!',
    role: 'artisan',
    fullName: 'Artisan Test',
  },
]

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(email) {
  // listUsers pagina; iteramos hasta encontrar.
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => u.email === email)
    if (found) return found
    if (data.users.length < perPage) return null
    page += 1
  }
}

async function ensureUser({ email, password, role, fullName }) {
  let user = await findUserByEmail(email)

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    })
    if (error) throw error
    user = data.user
    console.log(`[seed-e2e-users] creado auth user ${email} (${user.id})`)
  } else {
    console.log(`[seed-e2e-users] auth user ya existe ${email} (${user.id})`)
    // Asegurar password actual (idempotencia ante cambios).
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    })
    if (error) throw error
  }

  // Asegurar role en tabla "user".
  const { error: upsertErr } = await supabase
    .from('user')
    .upsert(
      { id: user.id, email, full_name: fullName, role },
      { onConflict: 'id' },
    )
  if (upsertErr) throw upsertErr
  console.log(`[seed-e2e-users] role=${role} asignado a ${email}`)

  // Triggers de creacion de profile (artisan/buyer) solo disparan en
  // INSERT del row de "user". Si el row existia con role distinto
  // (default buyer al crear auth) y lo actualizamos a artisan/admin,
  // hay que asegurar el profile manualmente.
  if (role === 'artisan') {
    const { error: artErr } = await supabase
      .from('artisan')
      .upsert({ user_id: user.id }, { onConflict: 'user_id' })
    if (artErr) throw artErr
  }
  if (role === 'buyer' || role === 'artisan' || role === 'admin') {
    // buyer profile sirve como fallback para puntos.
    if (role === 'buyer') {
      const { error: buyErr } = await supabase
        .from('buyer')
        .upsert({ user_id: user.id }, { onConflict: 'user_id' })
      if (buyErr) throw buyErr
    }
  }
}

async function main() {
  for (const u of TEST_USERS) {
    await ensureUser(u)
  }
  console.log('[seed-e2e-users] OK')
}

main().catch((err) => {
  console.error('[seed-e2e-users] ERROR', err)
  process.exit(1)
})
