/**
 * Konfigurasi Supabase untuk Guestbook.
 *
 * Langkah setup:
 *  1. Buat project di https://supabase.com
 *  2. Jalankan isi supabase/schema.sql di SQL Editor Supabase
 *  3. Aktifkan GitHub & Google di Authentication > Providers
 *  4. Tambahkan URL redirect di Authentication > URL Configuration:
 *       - Site URL       : https://domain-kamu.com
 *       - Redirect URLs  : https://domain-kamu.com/**
 *                          http://localhost/**  (untuk dev lokal)
 *  5. Isi supabaseUrl dan supabaseAnonKey di bawah
 *     (anon key aman dipublikasikan — RLS yang menjaga data)
 *
 * JANGAN masukkan service_role key di sini!
 */
window.GUESTBOOK_CONFIG = {
    supabaseUrl:    'https://tnctzqmydtxcgtozmdwq.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuY3R6cW15ZHR4Y2d0b3ptZHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MTA1NzUsImV4cCI6MjEwODI4NjU3NX0.SL62OTz52dnUYYo9scslhJZliZPOZrAUbralMW1PvEA',
    demoModeWhenUnconfigured: true,
};
