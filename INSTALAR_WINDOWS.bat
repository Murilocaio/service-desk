@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo   PROJETO SUPORTE CAIO - INSTALACAO WINDOWS
echo ================================================
echo.

where node >nul 2>nul
if not errorlevel 1 goto node_ok

rem Tenta localizar instalacoes comuns quando o PATH ainda nao foi atualizado.
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo.
  echo Se ele ja esta instalado, feche todas as janelas do CMD e abra uma nova.
  echo Tambem e possivel verificar com: where node
  echo.
  echo Download oficial: https://nodejs.org/en/download
  pause
  exit /b 1
)

:node_ok
where npm >nul 2>nul
if errorlevel 1 (
  echo ERRO: npm nao foi encontrado junto com o Node.js.
  echo Repare a instalacao do Node.js LTS e abra um novo CMD.
  pause
  exit /b 1
)

echo Node.js encontrado:
node --version
echo npm encontrado:
npm --version
echo.

echo Instalando as dependencias do projeto...
npm install
if errorlevel 1 goto erro

echo.
echo Instalando a CLI do Supabase no projeto...
npm install --save-dev supabase
if errorlevel 1 goto erro

echo.
echo Para conectar ao Supabase, sera necessario fazer login.
npx --yes supabase login
if errorlevel 1 goto erro

echo.
echo Vinculando ao projeto Supabase...
npx --yes supabase link --project-ref wyulqskmxfaahdmlwdyu
if errorlevel 1 goto erro

echo.
echo Aplicando as tabelas, funcoes e politicas do banco...
npx --yes supabase db push
if errorlevel 1 goto erro

echo.
echo ================================================
echo INSTALACAO CONCLUIDA!
echo ================================================
echo Para iniciar o sistema, execute:
echo npm run dev
echo.
echo Depois abra: http://localhost:3000
pause
exit /b 0

:erro
echo.
echo A instalacao nao foi concluida. Leia a mensagem acima.
pause
exit /b 1
