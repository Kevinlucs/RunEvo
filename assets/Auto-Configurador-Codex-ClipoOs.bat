@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ClipoOs Maxx - Reparar e Instalar Codex
cls

echo ==================================================
echo       CLIPOOS MAXX - REPARAR + INSTALAR CODEX
echo ==================================================
echo.
echo Este instalador:
echo   1. Faz backup da configuracao atual
echo   2. Remove configuracoes antigas da ClipoOs
echo   3. Faz o Codex recriar o config ORIGINAL
echo   4. Instala a configuracao ClipoOs validada
echo.
echo Cole sua API Key e pressione ENTER.
echo.

set /p "API_KEY=API Key: "

if not defined API_KEY (
    echo.
    echo ERRO: API Key nao informada.
    echo.
    pause
    exit /b 1
)

set "CLIPOOS_SETUP_KEY=%API_KEY%"
set "CLIPOOS_BAT_PATH=%~f0"
set "CLIPOOS_PSFILE=%TEMP%\clipoos_repair_install_%RANDOM%%RANDOM%.ps1"

echo.
echo Preparando reparo...

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=$env:CLIPOOS_BAT_PATH; $o=$env:CLIPOOS_PSFILE; $l=Get-Content -LiteralPath $p; $i=[Array]::IndexOf($l,'#PS1_PAYLOAD'); if($i -lt 0){exit 90}; $l[($i+1)..($l.Length-1)] | Set-Content -LiteralPath $o -Encoding UTF8"

if errorlevel 1 (
    echo.
    echo ERRO: Nao foi possivel preparar o instalador.
    echo.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CLIPOOS_PSFILE%"
set "SETUP_EXIT=%ERRORLEVEL%"

del /Q "%CLIPOOS_PSFILE%" >nul 2>&1
set "CLIPOOS_SETUP_KEY="
set "API_KEY="

echo.
if not "%SETUP_EXIT%"=="0" (
    echo ==================================================
    echo            REPARO NAO CONCLUIDO
    echo ==================================================
    echo.
    echo Codigo do erro: %SETUP_EXIT%
    echo.
    echo A janela permanecera aberta.
    echo.
    pause
    exit /b %SETUP_EXIT%
)

echo ==================================================
echo       CLIPOOS MAXX INSTALADO COM SUCESSO
echo ==================================================
echo.
echo Modelos:
echo   GPT5.6-SOL   - 1.000.000 tokens
echo   GPT5.6-TERRA - 1.000.000 tokens
echo   GPT5.6-LUNA  -   200.000 tokens
echo.
echo Web Search : ATIVADA
echo Responses  : ATIVADA
echo Provider   : ClipoOs Maxx
echo.
echo IMPORTANTE:
echo Abra o Codex Desktop e inicie uma CONVERSA NOVA.
echo.
pause
exit /b 0

#PS1_PAYLOAD
$ErrorActionPreference = 'Stop'

function Fail([string]$Message, [int]$Code) {
    Write-Host ""
    Write-Host ("ERRO: " + $Message) -ForegroundColor Red
    Write-Host ""
    exit $Code
}

function Write-Utf8NoBom([string]$Path, [System.Collections.Generic.List[string]]$Lines) {
    [System.IO.File]::WriteAllLines(
        $Path,
        $Lines,
        (New-Object System.Text.UTF8Encoding($false))
    )
}

function Stop-CodexDesktop {
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.ProcessName -ieq 'Codex' -or
            $_.ProcessName -ieq 'ChatGPT'
        } |
        Stop-Process -Force -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 2
}

function Start-CodexDesktop {
    $apps = @(Get-StartApps | Where-Object {
        $_.Name -match 'ChatGPT|Codex'
    })

    if ($apps.Count -eq 0) {
        return $false
    }

    $app = $apps |
        Sort-Object @{
            Expression = {
                if ($_.Name -ieq 'ChatGPT') { 0 }
                elseif ($_.Name -ieq 'Codex') { 1 }
                else { 2 }
            }
        } |
        Select-Object -First 1

    try {
        Start-Process explorer.exe -ArgumentList ("shell:AppsFolder\" + $app.AppID)
        return $true
    }
    catch {
        return $false
    }
}

function Test-OriginalCodexConfig([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return $false
    }

    try {
        $text = Get-Content -Raw -LiteralPath $Path

        $markers = @(
            'notify =',
            '[desktop]',
            '[windows]',
            '[marketplaces.openai-bundled]',
            '[plugins."browser@openai-bundled"]',
            '[mcp_servers.node_repl]',
            '[mcp_servers.node_repl.env]',
            'CODEX_CLI_PATH'
        )

        foreach ($marker in $markers) {
            if (-not $text.Contains($marker)) {
                return $false
            }
        }

        return $true
    }
    catch {
        return $false
    }
}

function Add-ClipoOsBaseToOriginalConfig(
    [string]$ConfigPath
) {
    $lines = @(Get-Content -LiteralPath $ConfigPath)

    # Se existir qualquer resto de configuracao ClipoOs no arquivo
    # recem-gerado, limpa apenas os campos que administramos.
    $root = New-Object System.Collections.Generic.List[string]
    $blocks = New-Object System.Collections.Generic.List[object]

    $currentHeader = $null
    $currentBody = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        if ($line -match '^\s*\[(.+)\]\s*$') {
            if ($null -ne $currentHeader) {
                $blocks.Add([pscustomobject]@{
                    Header = $currentHeader
                    Body   = @($currentBody)
                })
            }

            $currentHeader = $line
            $currentBody = New-Object System.Collections.Generic.List[string]
            continue
        }

        if ($null -eq $currentHeader) {
            $root.Add($line)
        }
        else {
            $currentBody.Add($line)
        }
    }

    if ($null -ne $currentHeader) {
        $blocks.Add([pscustomobject]@{
            Header = $currentHeader
            Body   = @($currentBody)
        })
    }

    $cleanRoot = New-Object System.Collections.Generic.List[string]

    foreach ($line in $root) {
        $t = $line.TrimStart()

        if (
            $t.StartsWith('model =') -or
            $t.StartsWith('model_provider =') -or
            $t.StartsWith('model_catalog_json =') -or
            $t.StartsWith('model_context_window =') -or
            $t.StartsWith('model_auto_compact_token_limit =') -or
            $t.StartsWith('web_search =')
        ) {
            continue
        }

        $cleanRoot.Add($line)
    }

    while ($cleanRoot.Count -gt 0 -and [string]::IsNullOrWhiteSpace($cleanRoot[0])) {
        $cleanRoot.RemoveAt(0)
    }

    while ($cleanRoot.Count -gt 0 -and [string]::IsNullOrWhiteSpace($cleanRoot[$cleanRoot.Count - 1])) {
        $cleanRoot.RemoveAt($cleanRoot.Count - 1)
    }

    $cleanBlocks = New-Object System.Collections.Generic.List[object]
    $featuresFound = $false

    foreach ($block in $blocks) {
        $name = $block.Header.Trim().TrimStart('[').TrimEnd(']')

        if ($name -eq 'model_providers.clipoos_maxx') {
            continue
        }

        if ($name -eq 'features') {
            $featuresFound = $true

            $body = New-Object System.Collections.Generic.List[string]
            $written = $false

            foreach ($line in $block.Body) {
                if ($line -match '^\s*standalone_web_search\s*=') {
                    if (-not $written) {
                        $body.Add('standalone_web_search = true')
                        $written = $true
                    }
                    continue
                }

                $body.Add($line)
            }

            if (-not $written) {
                $body.Insert(0, 'standalone_web_search = true')
            }

            $cleanBlocks.Add([pscustomobject]@{
                Header = $block.Header
                Body   = @($body)
            })

            continue
        }

        $cleanBlocks.Add($block)
    }

    # FASE A:
    # exatamente o cabecalho minimo que foi validado manualmente.
    $final = New-Object System.Collections.Generic.List[string]

    $final.Add('model = "GPT5.6-SOL"')
    $final.Add('model_provider = "clipoos_maxx"')
    $final.Add('web_search = "live"')

    foreach ($line in $cleanRoot) {
        $final.Add($line)
    }

    $final.Add('')

    foreach ($block in $cleanBlocks) {
        $final.Add($block.Header)

        foreach ($line in $block.Body) {
            $final.Add($line)
        }

        $final.Add('')
    }

    if (-not $featuresFound) {
        $final.Add('[features]')
        $final.Add('standalone_web_search = true')
        $final.Add('')
    }

    $final.Add('[model_providers.clipoos_maxx]')
    $final.Add('name = "ClipoOs Maxx"')
    $final.Add('base_url = "https://api.clipoos.online/v1"')
    $final.Add('env_key = "CLIPOOS_API_KEY"')
    $final.Add('wire_api = "responses"')
    $final.Add('requires_openai_auth = false')
    $final.Add('supports_websockets = false')
    $final.Add('supports_standalone_web_search = true')

    Write-Utf8NoBom -Path $ConfigPath -Lines $final
}

function Add-CatalogReference(
    [string]$ConfigPath,
    [string]$CatalogPath
) {
    $lines = New-Object System.Collections.Generic.List[string]

    foreach ($line in (Get-Content -LiteralPath $ConfigPath)) {
        if ($line.TrimStart().StartsWith('model_catalog_json =')) {
            continue
        }

        $lines.Add($line)
    }

    $literal = $CatalogPath.Replace("'", "''")
    $insertAt = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i].TrimStart().StartsWith('model_provider =')) {
            $insertAt = $i + 1
            break
        }
    }

    if ($insertAt -lt 0) {
        Fail "Nao foi possivel localizar model_provider no config final." 61
    }

    $lines.Insert(
        $insertAt,
        ("model_catalog_json = '" + $literal + "'")
    )

    Write-Utf8NoBom -Path $ConfigPath -Lines $lines
}

$key = $env:CLIPOOS_SETUP_KEY

if ([string]::IsNullOrWhiteSpace($key)) {
    Fail "API Key vazia." 11
}

$endpoint     = 'https://api.clipoos.online/v1'
$codexDir    = Join-Path $env:USERPROFILE '.codex'
$configPath  = Join-Path $codexDir 'config.toml'
$catalogPath = Join-Path $codexDir 'clipoos-models.json'
$oldCatalog  = Join-Path $codexDir 'clipoos_models.json'
$modelsJson  = Join-Path $codexDir 'models.json'

$requiredModels = @(
    'GPT5.6-SOL',
    'GPT5.6-TERRA',
    'GPT5.6-LUNA'
)

# ============================================================
# 1. VALIDA API ANTES DE ALTERAR O PC
# ============================================================

Write-Host ""
Write-Host "Validando API Key..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest `
        -Uri ($endpoint + '/models') `
        -Headers @{ Authorization = ('Bearer ' + $key) } `
        -Method GET `
        -UseBasicParsing `
        -TimeoutSec 20

    if ([int]$response.StatusCode -ne 200) {
        Fail ("API Key recusada. HTTP " + [int]$response.StatusCode) 12
    }

    try {
        $parsed = $response.Content | ConvertFrom-Json
        $ids = @($parsed.data | ForEach-Object { [string]$_.id })

        if ($ids.Count -gt 0) {
            $missing = @($requiredModels | Where-Object { $_ -notin $ids })

            if ($missing.Count -gt 0) {
                Fail ("Esta API Key nao possui acesso a: " + ($missing -join ', ')) 14
            }
        }
    }
    catch {
        # HTTP 200 continua sendo aceito mesmo se /models tiver outro formato.
    }
}
catch {
    $status = $null

    try {
        $status = [int]$_.Exception.Response.StatusCode
    }
    catch {}

    if ($status) {
        Fail ("API Key recusada. HTTP " + $status) 12
    }

    Fail ("Falha ao acessar " + $endpoint + " - " + $_.Exception.Message) 13
}

Write-Host "API Key validada." -ForegroundColor Green

# ============================================================
# 2. FECHA CODEX E FAZ BACKUP DE TUDO QUE PODE INTERFERIR
# ============================================================

Write-Host ""
Write-Host "Fechando Codex Desktop..." -ForegroundColor Cyan
Stop-CodexDesktop

try {
    New-Item -ItemType Directory -Force -Path $codexDir | Out-Null

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupDir = Join-Path $codexDir ('ClipoOs-Repair-Backup-' + $stamp)
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

    foreach ($path in @($configPath, $catalogPath, $oldCatalog, $modelsJson)) {
        if (Test-Path -LiteralPath $path) {
            Copy-Item `
                -LiteralPath $path `
                -Destination (Join-Path $backupDir ([IO.Path]::GetFileName($path))) `
                -Force
        }
    }
}
catch {
    Fail ("Falha ao criar backup: " + $_.Exception.Message) 20
}

Write-Host ("Backup: " + $backupDir) -ForegroundColor Green

# ============================================================
# 3. REPARO REAL:
# REMOVE CONFIG ATUAL E CATALOGOS/MODELS QUE PODEM TER SIDO
# CRIADOS PELAS VERSOES ANTIGAS.
# ============================================================

Write-Host ""
Write-Host "Removendo configuracoes antigas..." -ForegroundColor Cyan

try {
    foreach ($path in @($configPath, $catalogPath, $oldCatalog, $modelsJson)) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }
}
catch {
    Fail ("Falha ao remover configuracoes antigas: " + $_.Exception.Message) 21
}

# ============================================================
# 4. ABRE O CODEX PARA ELE MESMO RECRIAR O CONFIG ORIGINAL
# ============================================================

Write-Host ""
Write-Host "Recriando configuracao ORIGINAL do Codex..." -ForegroundColor Cyan
Write-Host ""
Write-Host "O Codex Desktop sera aberto agora."
Write-Host "Se o Windows pedir autorizacao, clique em SIM."
Write-Host "Nao altere nenhuma configuracao."
Write-Host ""

if (-not (Start-CodexDesktop)) {
    Write-Host "Nao consegui abrir o Codex automaticamente." -ForegroundColor Yellow
    Write-Host "Abra o Codex Desktop manualmente AGORA." -ForegroundColor Yellow
}

$deadline = (Get-Date).AddSeconds(150)
$originalReady = $false
$lastLength = -1
$stableCount = 0

while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2

    if (Test-OriginalCodexConfig -Path $configPath) {
        try {
            $len = (Get-Item -LiteralPath $configPath).Length

            if ($len -eq $lastLength -and $len -gt 0) {
                $stableCount++
            }
            else {
                $stableCount = 0
                $lastLength = $len
            }

            if ($stableCount -ge 2) {
                $originalReady = $true
                break
            }
        }
        catch {}
    }
}

if (-not $originalReady) {
    Fail "O Codex nao recriou o config.toml original completo em ate 150 segundos. Abra o Codex, conclua a tela inicial, feche-o e rode este instalador novamente." 30
}

Write-Host "Config ORIGINAL recriado pelo Codex." -ForegroundColor Green

# Backup adicional da copia ORIGINAL limpa.
try {
    Copy-Item `
        -LiteralPath $configPath `
        -Destination (Join-Path $backupDir 'config.ORIGINAL-GERADO-PELO-CODEX.toml') `
        -Force
}
catch {}

# Evita o Desktop escrever no arquivo enquanto instalamos.
Stop-CodexDesktop

# ============================================================
# 5. FASE A - CABECALHO MINIMO VALIDADO
# ============================================================

Write-Host ""
Write-Host "Aplicando cabecalho ClipoOs validado..." -ForegroundColor Cyan

try {
    Add-ClipoOsBaseToOriginalConfig -ConfigPath $configPath
}
catch {
    Fail ("Falha ao aplicar configuracao base: " + $_.Exception.Message) 40
}

# ============================================================
# 6. CRIA CATALOGO EXATAMENTE NO FORMATO DA V26 VALIDADA
# ============================================================

Write-Host "Criando catalogo dos modelos..." -ForegroundColor Cyan

try {
    $reasoning = @(
        [ordered]@{ effort = 'low';    description = 'Rapido' },
        [ordered]@{ effort = 'medium'; description = 'Equilibrado' },
        [ordered]@{ effort = 'high';   description = 'Profundo' },
        [ordered]@{ effort = 'xhigh';  description = 'Maximo' }
    )

    function New-ClipoOsModel {
        param(
            [string]$Slug,
            [string]$DisplayName,
            [string]$Description,
            [int64]$ContextWindow,
            [int64]$CompactLimit,
            [int]$Priority
        )

        return [ordered]@{
            slug = $Slug
            display_name = $DisplayName
            description = $Description
            default_reasoning_level = 'medium'
            supported_reasoning_levels = $reasoning
            shell_type = 'unified_exec'
            visibility = 'list'
            supported_in_api = $true
            priority = $Priority
            additional_speed_tiers = @()
            service_tiers = @()
            default_service_tier = $null
            availability_nux = $null
            upgrade = $null

            model_messages = [ordered]@{
                instructions_template = 'You are Codex, an agentic coding assistant. Use the tools available in the session when useful and complete tasks end to end.'
                instructions_variables = $null
                approvals = $null
                collaboration_modes = $null
                auto_review = $null
                permissions = $null
                multi_agent = $null
                token_budget = $null
                confirmation_policies = $null
                guardian_v2 = $null
            }

            include_skills_usage_instructions = $true
            include_plugin_usage_instructions = $true
            include_apps_usage_instructions = $true

            supports_reasoning_summary_parameter = $true
            default_reasoning_summary = 'none'

            support_verbosity = $true
            default_verbosity = 'low'

            apply_patch_tool_type = 'freeform'
            web_search_tool_type = 'text_and_image'

            truncation_policy = [ordered]@{
                mode = 'tokens'
                limit = 10000
            }

            supports_image_detail_original = $true

            context_window = $ContextWindow
            max_context_window = $ContextWindow
            auto_compact_token_limit = $CompactLimit
            effective_context_window_percent = 95

            experimental_supported_tools = @()
            input_modalities = @('text','image')

            supports_search_tool = $false
            use_responses_lite = $false

            node_repl_auto_review_required = $false
            node_repl_disabled = $false

            auto_review_model_override = $null
            model_specialty = $null

            tool_mode = $null
            multi_agent_version = $null
            multi_agent_reasoning_effort = $null
        }
    }

    $catalog = [ordered]@{
        models = @(
            (New-ClipoOsModel `
                -Slug 'GPT5.6-SOL' `
                -DisplayName 'GPT5.6-SOL' `
                -Description 'ClipoOs Maxx - 1.000.000 tokens de contexto.' `
                -ContextWindow 1000000 `
                -CompactLimit 200000 `
                -Priority 1),

            (New-ClipoOsModel `
                -Slug 'GPT5.6-TERRA' `
                -DisplayName 'GPT5.6-TERRA' `
                -Description 'ClipoOs Maxx - 1.000.000 tokens de contexto.' `
                -ContextWindow 1000000 `
                -CompactLimit 200000 `
                -Priority 2),

            (New-ClipoOsModel `
                -Slug 'GPT5.6-LUNA' `
                -DisplayName 'GPT5.6-LUNA' `
                -Description 'ClipoOs Maxx - 200.000 tokens de contexto.' `
                -ContextWindow 200000 `
                -CompactLimit 150000 `
                -Priority 3)
        )
    }

    $json = $catalog | ConvertTo-Json -Depth 20

    [System.IO.File]::WriteAllText(
        $catalogPath,
        $json,
        (New-Object System.Text.UTF8Encoding($false))
    )

    Get-Content -Raw -LiteralPath $catalogPath | ConvertFrom-Json | Out-Null
}
catch {
    Fail ("Falha ao criar catalogo: " + $_.Exception.Message) 50
}

Write-Host "Catalogo criado." -ForegroundColor Green

# ============================================================
# 7. FASE B - ADICIONA SOMENTE model_catalog_json POR ULTIMO
# ============================================================

Write-Host "Vinculando catalogo..." -ForegroundColor Cyan

try {
    Add-CatalogReference `
        -ConfigPath $configPath `
        -CatalogPath $catalogPath
}
catch {
    Fail ("Falha ao vincular catalogo: " + $_.Exception.Message) 60
}

# ============================================================
# 8. SALVA API KEY NO PERFIL DO USUARIO
# ============================================================

try {
    [Environment]::SetEnvironmentVariable(
        'CLIPOOS_API_KEY',
        $key,
        'User'
    )

    $env:CLIPOOS_API_KEY = $key
}
catch {
    Fail ("Falha ao salvar API Key no Windows: " + $_.Exception.Message) 70
}

# ============================================================
# 9. VALIDACAO FINAL
# ============================================================

Write-Host "Validando instalacao..." -ForegroundColor Cyan

try {
    $cfg = Get-Content -Raw -LiteralPath $configPath
    $cat = Get-Content -Raw -LiteralPath $catalogPath | ConvertFrom-Json

    $checks = @(
        'model = "GPT5.6-SOL"',
        'model_provider = "clipoos_maxx"',
        'model_catalog_json =',
        'web_search = "live"',
        'standalone_web_search = true',
        '[model_providers.clipoos_maxx]',
        'notify =',
        '[desktop]',
        '[windows]',
        '[plugins."browser@openai-bundled"]',
        '[mcp_servers.node_repl]',
        '[mcp_servers.node_repl.env]',
        'CODEX_CLI_PATH'
    )

    foreach ($check in $checks) {
        if (-not $cfg.Contains($check)) {
            Fail ("Validacao falhou. Campo ausente: " + $check) 80
        }
    }

    $slugs = @($cat.models | ForEach-Object { [string]$_.slug })

    foreach ($required in $requiredModels) {
        if ($required -notin $slugs) {
            Fail ("Modelo ausente no catalogo: " + $required) 81
        }
    }
}
catch {
    if ($_.Exception.Message -like 'Validacao falhou*' -or
        $_.Exception.Message -like 'Modelo ausente*') {
        throw
    }

    Fail ("Falha na validacao final: " + $_.Exception.Message) 82
}

Write-Host ""
Write-Host "REPARO + INSTALACAO CONCLUIDOS." -ForegroundColor Green
Write-Host ""
Write-Host ("Backup antigo:    " + $backupDir)
Write-Host ("Config original:  " + (Join-Path $backupDir 'config.ORIGINAL-GERADO-PELO-CODEX.toml'))
Write-Host ("Config instalado: " + $configPath)
Write-Host ("Catalogo:         " + $catalogPath)
Write-Host ""
Write-Host "Abra o Codex Desktop e crie uma CONVERSA NOVA."
Write-Host ""
exit 0
