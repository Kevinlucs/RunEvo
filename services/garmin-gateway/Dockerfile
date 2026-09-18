# Build do gateway Garmin em container (nao exige Go instalado no host).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY ndeloof-go-garmin /src/ndeloof-go-garmin
COPY . /src/services/garmin-gateway
WORKDIR /src/services/garmin-gateway
RUN gofmt -l . && go test ./... && go build -o /out/garmin-gateway .

FROM alpine:3.20
RUN adduser -D -u 10001 gateway
COPY --from=build /out/garmin-gateway /usr/local/bin/garmin-gateway
USER gateway
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["garmin-gateway"]
