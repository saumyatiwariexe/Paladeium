import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Safety check: only initialize if keys are present and valid-looking
const isValidUrl = (url) => {
  try {
    return url && new URL(url).protocol.startsWith('http')
  } catch {
    return false
  }
}

let supabaseInstance;

if (isValidUrl(supabaseUrl) && supabaseAnonKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('Supabase credentials missing or invalid. Contact form will be disabled.')
  // Create a dummy client that doesn't crash on init but fails on calls
  supabaseInstance = {
    from: () => ({
      insert: () => Promise.resolve({ error: new Error('Supabase not configured') })
    })
  }
}

export const supabase = supabaseInstance
