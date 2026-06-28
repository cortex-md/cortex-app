#!/usr/bin/env fish

# Android SDK para Expo SDK 56 / Android API 36
set ANDROID_API 36
set BUILD_TOOLS_VERSION 36.0.0
set NDK_VERSION 27.1.12297006
set CMAKE_VERSION 3.22.1

set SDK_DIR "$HOME/Library/Android/sdk"
set CMDLINE_TOOLS_URL "https://dl.google.com/android/repository/commandlinetools-mac-14742923_latest.zip"

function fail
    echo "❌ $argv" >&2
    exit 1
end

function info
    echo ""
    echo "==> $argv"
end

# Homebrew
if not command -q brew
    fail "Homebrew não encontrado. Instale o Homebrew primeiro e rode o script novamente."
end

info "Instalando dependências via Homebrew"
brew update
brew install openjdk@17 watchman curl unzip

# Java 17
set JAVA_HOME_DIR (brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home

set -Ux JAVA_HOME "$JAVA_HOME_DIR"
fish_add_path -U "$JAVA_HOME_DIR/bin"

# Node >= 22.13
set NEED_NODE_22 1

if command -q node
    node -e '
const [major, minor] = process.versions.node.split(".").map(Number);
process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1);
'
    if test $status -eq 0
        set NEED_NODE_22 0
    end
end

if test "$NEED_NODE_22" = "1"
    info "Instalando Node 22 porque Expo SDK 56 exige Node >= 22.13.x"
    brew install node@22
    fish_add_path -U (brew --prefix node@22)/bin
end

# Android SDK dirs
info "Preparando Android SDK em $SDK_DIR"
mkdir -p "$SDK_DIR/cmdline-tools"

set SDKMANAGER "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager"

# Baixar command-line tools se ainda não existe
if not test -x "$SDKMANAGER"
    info "Baixando Android Command Line Tools sem Android Studio"

    set TMP_DIR (mktemp -d)
    set ZIP_FILE "$TMP_DIR/cmdline-tools.zip"

    curl -L "$CMDLINE_TOOLS_URL" -o "$ZIP_FILE"; or fail "Falha ao baixar Command Line Tools"
    unzip -q "$ZIP_FILE" -d "$TMP_DIR"; or fail "Falha ao extrair Command Line Tools"

    rm -rf "$SDK_DIR/cmdline-tools/latest"
    mkdir -p "$SDK_DIR/cmdline-tools/latest"

    mv "$TMP_DIR/cmdline-tools/"* "$SDK_DIR/cmdline-tools/latest/"; or fail "Falha ao mover Command Line Tools"

    rm -rf "$TMP_DIR"
end

# Variáveis Android
set -Ux ANDROID_HOME "$SDK_DIR"
set -Ux ANDROID_SDK_ROOT "$SDK_DIR"

fish_add_path -U "$SDK_DIR/platform-tools"
fish_add_path -U "$SDK_DIR/cmdline-tools/latest/bin"
fish_add_path -U "$SDK_DIR/emulator"

set SDKMANAGER "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager"

info "Aceitando licenças do Android SDK"
yes | "$SDKMANAGER" --sdk_root="$SDK_DIR" --licenses >/dev/null

info "Instalando pacotes Android necessários para Expo / React Native"
"$SDKMANAGER" --sdk_root="$SDK_DIR" \
    "cmdline-tools;latest" \
    "platform-tools" \
    "platforms;android-$ANDROID_API" \
    "build-tools;$BUILD_TOOLS_VERSION" \
    "emulator" \
    "ndk;$NDK_VERSION" \
    "cmake;$CMAKE_VERSION"; or fail "Falha ao instalar pacotes Android"

# Cria local.properties se você estiver dentro de um projeto com pasta android
if test -d android
    info "Criando android/local.properties"
    echo "sdk.dir=$SDK_DIR" > android/local.properties
end

info "Verificando instalação"

echo ""
echo "Java:"
java -version

echo ""
echo "Node:"
node -v

echo ""
echo "ADB:"
"$SDK_DIR/platform-tools/adb" version

echo ""
echo "SDK instalado:"
"$SDKMANAGER" --sdk_root="$SDK_DIR" --list_installed | grep -E "platform-tools|platforms;android-$ANDROID_API|build-tools;$BUILD_TOOLS_VERSION|ndk;$NDK_VERSION|cmake;$CMAKE_VERSION"

echo ""
echo "✅ Android SDK instalado com sucesso."
echo ""
echo "Feche e abra o terminal novamente, ou rode:"
echo "exec fish"
echo ""
echo "Depois teste no projeto Expo com:"
echo "npx expo-doctor"
echo "npx expo run:android"
