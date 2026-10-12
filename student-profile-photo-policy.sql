-- Allow each authenticated student to read only their own linked profile and photo.
-- Run once in the Supabase SQL Editor for this project.

alter table public.student_portal_accounts enable row level security;
drop policy if exists student_portal_accounts_read_self on public.student_portal_accounts;
create policy student_portal_accounts_read_self
on public.student_portal_accounts for select to authenticated
using (user_id = auth.uid());

alter table public."Student" enable row level security;
drop policy if exists student_portal_profile_read_self on public."Student";
create policy student_portal_profile_read_self
on public."Student" for select to authenticated
using (
    exists (
        select 1
        from public.student_portal_accounts spa
        where spa.user_id = auth.uid()
          and spa.student_id::text = id::text
    )
);

-- The existing restrictive class-media policy also applies to all storage buckets.
-- Extend its guard for student_photos while keeping each student limited to their own photo.
drop policy if exists student_portal_media_read_guard on storage.objects;
create policy student_portal_media_read_guard
on storage.objects as restrictive
for select to authenticated
using (
    auth.uid() = 'ed5ab433-a082-41cc-81b0-bd2b65cdaa0b'::uuid
    or (
        bucket_id = 'class-media'
        and split_part(name, '/', 1) in ('videos', 'photos', 'pdfs')
        and exists (
            select 1 from public.student_portal_accounts spa
            where spa.user_id = auth.uid()
        )
    )
    or (
        bucket_id = 'student_photos'
        and exists (
            select 1
            from public.student_portal_accounts spa
            join public."Student" s on spa.student_id::text = s.id::text
            where spa.user_id = auth.uid()
              and s."Photo_url" = storage.objects.name
        )
    )
);

drop policy if exists student_portal_student_photo_read_self on storage.objects;
create policy student_portal_student_photo_read_self
on storage.objects for select to authenticated
using (
    bucket_id = 'student_photos'
    and exists (
        select 1
        from public.student_portal_accounts spa
        join public."Student" s on spa.student_id::text = s.id::text
        where spa.user_id = auth.uid()
          and s."Photo_url" = storage.objects.name
    )
);