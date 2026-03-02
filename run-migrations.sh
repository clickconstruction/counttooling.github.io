#!/bin/bash
# Run Supabase migrations via CLI.
# Requires: supabase link (once) and Supabase CLI.
# First time: supabase link --project-ref hrqxvfydmvtvwhvefmqc
# Usage: ./run-migrations.sh
set -e
cd "$(dirname "$0")"
echo "Pushing migrations to linked Supabase project..."
supabase db push
echo "Done."
