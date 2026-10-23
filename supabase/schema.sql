-- =============================================================
-- Guestbook schema — Swandy Sianturi Portfolio
-- Jalankan seluruh isi file ini di SQL Editor Supabase:
--   Dashboard → SQL Editor → New query → Paste → Run
-- =============================================================

-- 1. Buat tabel
CREATE TABLE IF NOT EXISTS public.guestbook (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at    TIMESTAMPTZ NOT NULL    DEFAULT now(),
    user_id       UUID        NOT NULL    REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name     TEXT        NOT NULL,
    user_avatar   TEXT,
    user_provider TEXT,
    message       TEXT        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 280),
    is_pinned     BOOLEAN     NOT NULL    DEFAULT false,
    parent_id     UUID                    REFERENCES public.guestbook(id) ON DELETE CASCADE
);

-- 2. Indeks
CREATE INDEX IF NOT EXISTS guestbook_created_at_idx ON public.guestbook (created_at);
CREATE INDEX IF NOT EXISTS guestbook_parent_id_idx  ON public.guestbook (parent_id);

-- 3. Trigger: isi author dari JWT + validasi satu level reply + cegah pin dari klien
CREATE OR REPLACE FUNCTION public.handle_guestbook_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Isi author dari JWT (tidak bisa dipalsukan)
    new.user_id       := auth.uid();
    new.user_name     := COALESCE(
                           auth.jwt()->'user_metadata'->>'full_name',
                           auth.jwt()->'user_metadata'->>'user_name',
                           auth.jwt()->'user_metadata'->>'name',
                           split_part(auth.jwt()->>'email', '@', 1),
                           'Tamu'
                         );
    new.user_avatar   := auth.jwt()->'user_metadata'->>'avatar_url';
    new.user_provider := COALESCE(auth.jwt()->'app_metadata'->>'provider', 'email');
    new.is_pinned     := false;  -- klien tidak bisa langsung pin
    new.created_at    := now();

    -- Validasi: reply hanya boleh ke pesan utama (satu level)
    IF new.parent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.guestbook
            WHERE id = new.parent_id AND parent_id IS NULL
        ) THEN
            RAISE EXCEPTION 'Balasan hanya diizinkan satu level.';
        END IF;
    END IF;

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_guestbook_insert ON public.guestbook;
CREATE TRIGGER on_guestbook_insert
    BEFORE INSERT ON public.guestbook
    FOR EACH ROW EXECUTE FUNCTION public.handle_guestbook_insert();

-- 4. Row Level Security
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;

-- Siapa saja bisa membaca
DROP POLICY IF EXISTS "public can read guestbook"       ON public.guestbook;
CREATE POLICY "public can read guestbook"
    ON public.guestbook FOR SELECT USING (true);

-- Pengguna yang login bisa insert (trigger menjamin user_id = auth.uid())
DROP POLICY IF EXISTS "authenticated can insert guestbook" ON public.guestbook;
CREATE POLICY "authenticated can insert guestbook"
    ON public.guestbook FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Pengguna hanya bisa menghapus pesan miliknya sendiri
DROP POLICY IF EXISTS "users can delete own guestbook"  ON public.guestbook;
CREATE POLICY "users can delete own guestbook"
    ON public.guestbook FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- (Opsional) Admin bisa menghapus semua pesan — ganti email di bawah
-- DROP POLICY IF EXISTS "admin can delete any guestbook" ON public.guestbook;
-- CREATE POLICY "admin can delete any guestbook"
--     ON public.guestbook FOR DELETE TO authenticated
--     USING (auth.jwt()->>'email' = 'kamu@email.com');

-- (Opsional) Admin bisa update is_pinned — ganti email di bawah
-- DROP POLICY IF EXISTS "admin can update pin" ON public.guestbook;
-- CREATE POLICY "admin can update pin"
--     ON public.guestbook FOR UPDATE TO authenticated
--     USING  (auth.jwt()->>'email' = 'kamu@email.com')
--     WITH CHECK (auth.jwt()->>'email' = 'kamu@email.com');

-- 5. Grant
GRANT USAGE  ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.guestbook TO anon, authenticated;
GRANT INSERT, DELETE ON public.guestbook TO authenticated;

-- 6. Realtime (agar perubahan disiarkan ke semua klien)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.guestbook;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================
-- Setelah ini:
--  • Untuk PIN sebuah pesan: UPDATE public.guestbook SET is_pinned = true WHERE id = '...';
--  • Untuk HAPUS pesan (sebagai admin): DELETE FROM public.guestbook WHERE id = '...';
-- =============================================================
