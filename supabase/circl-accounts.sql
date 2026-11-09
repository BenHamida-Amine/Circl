begin;

create table public.circl_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null,
  display_name text,
  username text unique,
  phone text,
  social_url text,
  constraint circl_profile_shape check (
    (
      account_type = 'person'
      and display_name is not null and char_length(display_name) between 1 and 100
      and username is not null and username ~ '^[a-z0-9_]{3,24}$'
      and phone is null and social_url is null
    ) or (
      account_type = 'organization'
      and display_name is null and username is null
      and phone is not null and phone ~ '^[+][1-9][0-9]{7,14}$'
      and social_url is not null and char_length(social_url) <= 500
      and social_url ~* '^https://([a-z0-9-]+[.])*(linkedin[.]com|facebook[.]com|instagram[.]com|x[.]com|twitter[.]com|tiktok[.]com|youtube[.]com|threads[.]net|threads[.]com|bsky[.]app)/[^[:space:]?#][^[:space:]]*$'
    )
  )
);

alter table public.circl_profiles enable row level security;
revoke all on public.circl_profiles from public, anon, authenticated;
grant select on public.circl_profiles to authenticated;
create policy "Members can read their own profile"
  on public.circl_profiles for select to authenticated
  using ((select auth.uid()) = id);

create function public.circl_create_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  profile jsonb := new.raw_user_meta_data;
begin
  insert into public.circl_profiles (id, account_type, display_name, username, phone, social_url)
  values (
    new.id,
    profile ->> 'account_type',
    nullif(btrim(profile ->> 'display_name'), ''),
    nullif(lower(btrim(profile ->> 'username')), ''),
    nullif(btrim(profile ->> 'phone'), ''),
    nullif(btrim(profile ->> 'social_url'), '')
  );
  return new;
end;
$$;

revoke all on function public.circl_create_profile() from public, anon, authenticated;
create trigger circl_create_profile after insert on auth.users
  for each row execute function public.circl_create_profile();

commit;
