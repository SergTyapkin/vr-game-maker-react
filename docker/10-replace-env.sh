#!/usr/bin/env bash
set -eu

echo "=== Replacing runtime environment variables in Next.js static export ==="

# Путь к статике
STATIC_DIR="/usr/share/nginx/html"

# Заменяем во всех HTML и JS файлах (самый надёжный способ для static export)
find "$STATIC_DIR" -type f \( -name "*.html" -o -name "*.js" \) -print0 | \
while IFS= read -r -d '' file; do
    sed -i \
        -e "s|__NEXT_PUBLIC_WS_HOST__|${NEXT_PUBLIC_WS_HOST}|g" \
        -e "s|__NEXT_PUBLIC_WS_PORT__|${NEXT_PUBLIC_WS_PORT}|g" \
        -e "s|__NEXT_PUBLIC_ROBOT_ID__|${NEXT_PUBLIC_ROBOT_ID}|g" \
        "$file"
done

echo "Environment variables replaced successfully."