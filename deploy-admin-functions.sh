#!/bin/bash
# Deploy admin Edge Functions with JWT verification disabled.
# Run from project root. Requires: supabase link (once) and supabase CLI.
set -e
cd "$(dirname "$0")"
echo "Deploying admin functions with --no-verify-jwt..."
supabase functions deploy admin-list-users --no-verify-jwt
supabase functions deploy admin-create-user --no-verify-jwt
supabase functions deploy admin-delete-user --no-verify-jwt
echo "Done."
