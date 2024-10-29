# BUILD step
FROM golang:1.23-alpine AS builder

RUN apk add --no-progress --no-cache \
  gcc \
  musl-dev \
  linux-headers

# Switch to app dir
WORKDIR /app

COPY ./src ./

RUN go build -a -tags musl -o beholder-ci

# PACKAGE step
FROM alpine:latest
RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /app/beholder-ci /app/beholder-ci
ENTRYPOINT ["ls"]