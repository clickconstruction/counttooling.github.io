-- Revert user_artboards feature (undoes 032_user_artboards and 033_migrate_airboard_to_artboards)
drop table if exists public.user_artboards cascade;;
