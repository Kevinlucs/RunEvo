# Garmin Gateway (temporário)

Gateway Go que isola a integração Garmin privada (`ndeloof/go-garmin`) do resto do RunEvo.

Fluxo:

```
React Native -> Supabase Edge Function (integration-status) -> este gateway -> Garmin Connect
```

O app e a Edge Function nunca recebem e-mail, senha, cookies ou tokens Garmin. Toda
autenticação Edge -> gateway usa HMAC-SHA256 com timestamp, nonce e hash do corpo.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase (https://xxx.supabase.co). |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | service_role. Somente no host do gateway. |
| `WATCH_GATEWAY_HMAC_SECRET` | sim | Mesmo valor do secret da Edge Function. |
| `GARMIN_TOKEN_ENCRYPTION_KEY` | sim | Base64 de 32 bytes (AES-256-GCM) para cifrar tokens Garmin. |
| `PUBLIC_BASE_URL` | sim | URL HTTPS pública do gateway (nunca localhost em produção). |
| `APP_DEEP_LINK_URL` | não | Deep link de retorno após conectar (padrão `runevo://profile/watches/garmin?garmin=connected`). |
| `PORT` | não | Porta HTTP (padrão 8080). |

## Endpoints

- `GET /health` — verificação de vida.
- `POST /v1/connect/start` — (HMAC) cria tentativa de conexão e devolve URL de login.
- `GET /v1/connect?state=...` — página pública de login (e-mail/senha vão só até aqui).
- `POST /v1/connect/complete` — submete credenciais; redireciona para MFA se necessário.
- `GET /v1/connect/mfa?state=...` — página do código 2FA.
- `POST /v1/connect/mfa/complete` — conclui o 2FA.
- `POST /v1/workouts/send` — (HMAC) cria, agenda e envia workout aos relógios compatíveis.
- `POST /v1/disconnect` — (HMAC) limpa credencial persistida do usuário.

## Build e execução

Requer Go 1.26+.

```powershell
cd services/garmin-gateway
go build .
# definir as variáveis de ambiente e executar:
.\garmin-gateway.exe
```

A dependência `go-garmin` é resolvida pelo `replace` para `.vendor/ndeloof-go-garmin`.

## Segurança

- Tokens DI Garmin são cifrados com AES-256-GCM associados ao `user_id`.
- Nonces persistidos na tabela `garmin_gateway_nonces` impedem replay.
- Idempotência de envio via RPC `claim_garmin_workout_sync` (advisory lock).
- Rotação de refresh token com lock em memória: **rode exatamente uma réplica** do
  gateway até existir lock distribuído.
- Sem HTTPS público o gateway não deve ser exposto.
- Nunca registre tokens/credenciais em logs.

## Supabase (executar manualmente)

```powershell
npx supabase db push
npx supabase functions deploy integration-status
```

Secrets da Edge Function:

```
GARMIN_PRIVATE_API_ENABLED=true
GARMIN_TRAINING_SYNC_ENABLED=true
WATCH_GATEWAY_URL=https://SEU-GATEWAY
WATCH_GATEWAY_HMAC_SECRET=<mesmo valor do gateway>
```

## Limitações conhecidas

- API não oficial: pode mudar sem aviso; 429 deve ser respeitado (sem retry).
- `go-garmin` limita rate de IPs de datacenter agressivamente.
- Logout remoto no Garmin não é suportado; desconectar remove a credencial local,
  o que basta para revogar o acesso do RunEvo.
