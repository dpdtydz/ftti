-- Create user_profiles table (Missing dependency)
create table
  public.user_profiles (
    id uuid not null,
    email text null,
    nickname text null,
    is_active boolean null default true,
    send_time text null default '08:00'::text,
    preferred_send_time text null default '08:00'::text,
    created_at timestamp with time zone not null default now(),
    constraint user_profiles_pkey primary key (id),
    constraint user_profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade
  ) tablespace pg_default;

-- Add RLS policies (Optional but recommended)
alter table public.user_profiles enable row level security;

create policy "Users can view their own profil  e"
on public.user_profiles for select
using ( auth.uid() = id );

create policy "Users can update their own profile"
on public.user_profiles for update
using ( auth.uid() = id );

-- Trigger to create profile on signup (Standard Supabase pattern)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, nickname)
  values (new.id, new.email, new.raw_user_meta_data ->> 'nickname');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
