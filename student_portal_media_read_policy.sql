-- Run once after student_portal_accounts exists.
-- Only the class admin and linked student accounts can read class media.
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
            select 1
            from public.student_portal_accounts as spa
            where spa.user_id = auth.uid()
        )
    )
);
