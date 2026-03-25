#!/bin/bash
# DB setup: link, push migrations, seed
# Prerequisite: run `npx supabase login` once (opens browser)

set -e
cd "$(dirname "$0")/.."

# Extract project ref from NEXT_PUBLIC_SUPABASE_URL
ENV_FILE=".env.local"
[ -f .env ] && ENV_FILE=".env"
[ -f .env.local ] && ENV_FILE=".env.local"
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
PROJECT_REF="${SUPABASE_URL#https://}"
PROJECT_REF="${PROJECT_REF%%.supabase.co}"
if [ -z "$PROJECT_REF" ] || [ "$PROJECT_REF" = "https://" ]; then
  echo "Error: Set NEXT_PUBLIC_SUPABASE_URL in .env.local (e.g. https://xxx.supabase.co)"
  exit 1
fi

echo "Project ref: $PROJECT_REF"
echo "Linking..."
npx supabase link --project-ref "$PROJECT_REF"

if [ "$1" = "link" ]; then
  echo "Link complete. Run 'npm run db:push' then 'npm run db:seed'."
  exit 0
fi

echo "Pushing migrations..."
npx supabase db push
echo "Seeding..."
npx supabase db seed
echo "Done. Add yourself to the org via Dashboard SQL or app when logged in."
