-- Ceramika Nero — Phase 4 activation fix
--
-- Tightens public read policies for blog posts and content pages so that future
-- scheduled posts are not visible before their published_at time. This is a
-- forward-only correction discovered during integration testing against the
-- real project. It does not modify or drop any existing data or tables.

drop policy if exists "Public blog posts are published" on public.blog_posts;

create policy "Public blog posts are published"
  on public.blog_posts for select
  using (
    status = 'published'
    and archived_at is null
    and (published_at is null or published_at <= timezone('utc'::text, now()))
  );

drop policy if exists "Public content pages are published" on public.content_pages;

create policy "Public content pages are published"
  on public.content_pages for select
  using (
    status = 'published'
    and archived_at is null
    and (published_at is null or published_at <= timezone('utc'::text, now()))
  );
