# Build do gateway Garmin em container (nao exige Go instalado no host).
# Contexto de build: raiz do projeto, para que .vendor/ndeloof-go-garmin seja copiavel.
# docker build -f services/garmin-gateway/Dockerfile -t runevo-garmin-gateway .
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY .vendor/ndeloof-go-garmin /src/.vendor/ndeloof-go-garmin
COPY services/garmin-gateway /src/services/garmin-gateway
WORKDIR /src/services/garmin-gateway
RUN gofmt -l . && go test ./... && go build -o /out/garmin-gateway .

FROM alpine:3.20
RUN adduser -D -u 10001 gateway
COPY --from=build /out/garmin-gateway /usr/local/bin/garmin-gateway
USER gateway
EXPOSE 8080
ENTRYPOINT ["garmin-gateway"]
