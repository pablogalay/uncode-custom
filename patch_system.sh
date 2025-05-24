#!/bin/bash

set -e

echo ">> Activando entorno Conda (si está disponible)..."
if command -v conda &> /dev/null; then
    source ~/miniconda3/bin/activate python3.6_uncode || echo "No se pudo activar el entorno Conda."
else
    echo "⚠️ Conda no está instalado o no está en el PATH."
fi

# Rutas base
PATCH_DIR="./patches"
CONDA_ENV_PATH="$HOME/miniconda3/envs/python3.6_uncode/lib/python3.6/site-packages"

echo ">> Sustituyendo archivos locales en entorno Conda..."

# Sustituir archivos locales
sudo cp "$PATCH_DIR/parsable_text.py" "$CONDA_ENV_PATH/inginious/frontend/"
sudo cp "$PATCH_DIR/hdlgrader.js" "$CONDA_ENV_PATH/inginious/frontend/plugins/multilang/static/"

# Borrar caché de Python
sudo rm -rf "$CONDA_ENV_PATH/inginious/frontend/plugins/multilang/__pycache__"

echo "✅ Archivos locales sustituidos."

# Función para buscar y sustituir archivo
patch_file() {
    local filename=$1
    local replacement_path="$PATCH_DIR/$filename"

    echo ">> Buscando ubicaciones de $filename..."

    matches=$(sudo find / -type f -iname "$filename" 2>/dev/null)

    if [ -z "$matches" ]; then
        echo "⚠️ No se encontró ninguna instancia de $filename en el sistema."
    else
        echo "Encontradas las siguientes rutas para $filename:"
        echo "$matches"
        echo

        while IFS= read -r path; do
            echo ">> Sustituyendo $filename en: $path"
            sudo cp "$replacement_path" "$path"
        done <<< "$matches"

        echo "✅ $filename sustituido en todas las ubicaciones encontradas."
    fi
}

# Parchear graders.py y feedback_tools.py
patch_file "graders.py"
patch_file "feedback_tools.py"

echo "✅ Todos los parches aplicados correctamente."