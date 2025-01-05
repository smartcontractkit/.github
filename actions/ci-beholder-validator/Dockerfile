# BUILD step
FROM golang:1.23-alpine AS builder

RUN apk add --no-progress --no-cache \
  gcc \
  musl-dev \
  linux-headers

# Switch to app dir
WORKDIR /app

COPY ./src ./

RUN go build -a -tags musl -o beholder-schema-validator

# PACKAGE step
FROM alpine:latest

COPY --from=builder /app/beholder-schema-validator /app/beholder-schema-validator
ENTRYPOINT ["/app/beholder-schema-validator"]