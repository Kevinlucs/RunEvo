# Mitigação do Cloudflare no Gateway Garmin

## Problema Confirmado

O log do Railway mostra:

`json
{
  "message": "garmin login rejected",
  "attributes": {
    "kind": "request_failed",
    "error": "portal: non-JSON Garmin response (HTTP 403): <!DOCTYPE html><html lang=\""en-US\""><head><title>Just a moment...</title>..."
  }
}
`

**Causa raiz**: O Cloudflare está bloqueando requisições do Railway (IP de datacenter) porque o \
et/http\ do Go não consegue passar pelo challenge Cloudflare. O próprio código do go-garmin menciona isso:

\\\go
// The web "widget" HTML flow (CSRF scrape) is intentionally skipped: it needs
// TLS impersonation (curl_cffi) to pass Cloudflare, which net/http cannot do.
\\\

## Soluções Possíveis

### 1. Proxy Residencial (Mais Viável no Curto Prazo)

Configurar um proxy residencial para o gateway Garmin no Railway:

\\\ash
# No Railway, adicionar variáveis de ambiente:
PROXY_URL=socks5://proxy.residencial.com:1080
PROXY_USER=usuario
PROXY_PASSWORD=senha
\\\

Modificar \main.go\ para usar o proxy quando configurado:

\\\go
func newServer() (*Server, error) {
    // ... código existente ...
    
    // Adicionar suporte a proxy
    if proxyURL := os.Getenv("PROXY_URL"); proxyURL != "" {
        proxy, err := url.Parse(proxyURL)
        if err == nil {
            if proxyUser := os.Getenv("PROXY_USER"); proxyUser != "" {
                proxy.User = url.UserPassword(proxyUser, os.Getenv("PROXY_PASSWORD"))
            }
            transport := &http.Transport{Proxy: http.ProxyURL(proxy)}
            // Usar nos clients HTTP
        }
    }
    
    // ... restante do código ...
}
\\\

**Serviços de proxy residencial**:
- Bright Data
- Oxylabs
- Smartproxy
- IPRoyal

### 2. Egress IP Fixo no Railway

O Railway oferece egress IP fixo para projetos pagos:

1. Atualizar para plano com egress IP fixo
2. Configurar o serviço para usar o IP fixo
3. Whitelist o IP no Garmin (se aplicável)

### 3. Migrar para Garmin Health API OAuth (Oficial)

A solução mais robusta é usar a API oficial Garmin Health:

- [Garmin Health API](https://developer.garmin.com/health-api/)
- Usa OAuth 2.0 (sem credenciais de usuário/senha)
- Sem desafios Cloudflare
- Permite integração oficial

**Pré-requisitos**:
- Cadastro como Garmin Health Partner
- Configurar OAuth app
- Redirecionar usuários para Garmin Connect para autorizar

### 4. Executar o Gateway Localmente

Como solução temporária:

1. Executar o gateway localmente (IP residencial)
2. Usar ngrok ou Cloudflare Tunnel para expor o endpoint
3. Configurar o app para usar o tunnel

### 5. Solução Híbrida (Recomendada)

Implementar fallback automático:

\\\go
// Tenta Railway primeiro, se falhar por Cloudflare, usa proxy
if err := tryLoginDirect(ctx, email, password); isCloudflareError(err) {
    if proxyConfigured {
        return tryLoginWithProxy(ctx, email, password)
    }
}
\\\

## Próximos Passos Imediatos

1. ✅ **Já feito**: Melhorar logs para identificar Cloudflare (aplicado no \main.go\)
2. ⏳ **Fazer**: Commit e push das alterações de log
3. ⏳ **Avaliar**: Escolher uma solução de mitigação acima
4. ⏳ **Implementar**: Configurar proxy ou migrar para OAuth

## Logs a Monitorar

Após aplicar qualquer solução, monitore os logs do Railway por:

- \"kind": "login_failed"\ - Confirma que ErrLoginFailed está sendo tratado
- \"error": "non-JSON Garmin response (HTTP 403)"\ - Cloudflare ainda bloqueando
- \"kind": "rate_limited"\ - Outro tipo de bloqueio
- Sucesso em login (logs de \inishConnection\)

## Recursos

- [Documentação go-garmin](https://github.com/ndeloof/go-garmin)
- [Railway Egress IP](https://docs.railway.app/reference/network-egress)
- [Garmin Health API](https://developer.garmin.com/health-api/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) - alternativa CAPTCHA