FROM golang:1.21-alpine as builder
WORKDIR /app

COPY go.* ./
RUN go mod download

COPY . .
RUN go build -o main .

FROM alpine:latest

COPY --from=builder /app/main /app/main

ENTRYPOINT [ "/app/main" ]