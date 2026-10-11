-- Run once in Supabase SQL Editor to enable private admin uploads.
insert into storage.buckets (id, name, public, file_size_limit)
values ('class-media', 'class-media', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Class admins can read class media" on storage.objects;
create policy "Class admins can read class media"
on storage.objects for select to authenticated
using (
    bucket_id = 'class-media'
    and split_part(name, '/', 1) in ('videos', 'photos', 'pdfs')
);

drop policy if exists "Class admins can upload class media" on storage.objects;
create policy "Class admins can upload class media"
on storage.objects for insert to authenticated
with check (
    bucket_id = 'class-media'
    and split_part(name, '/', 1) in ('videos', 'photos', 'pdfs')
);

drop policy if exists "Class admins can delete class media" on storage.objects;
create policy "Class admins can delete class media"
on storage.objects for delete to authenticated
using (
    bucket_id = 'class-media'
    and split_part(name, '/', 1) in ('videos', 'photos', 'pdfs')
);
