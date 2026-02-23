FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN go build -o wait-for-checks ./action/

FROM alpine:3.23
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/wait-for-checks /usr/local/bin/wait-for-checks

ENTRYPOINT ["/usr/local/bin/wait-for-checks"]
