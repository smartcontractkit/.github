FROM golang:1.25-alpine AS builder

WORKDIR /app
COPY main.go .
RUN go mod init github.com/auth-service && \
    go build -o auth-service .

FROM alpine:3.23

RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/auth-service .

ENV AUTH_SERVICE_PORT=9001
EXPOSE ${AUTH_SERVICE_PORT}

CMD ["/app/auth-service"]
