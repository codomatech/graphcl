FROM golang:1.24-alpine as gobuilder
MAINTAINER Codoma.tech Advanced Technologies <info@codoma.tech>

ADD ./src /app
WORKDIR /app

RUN go mod vendor
RUN GOOS=linux \
    GOARCH=amd64 \
    CGO_ENABLED=0 \
    go build \
      -mod=vendor \
      -a \
      -trimpath \
      -installsuffix cgo \
      -ldflags="-w -s" \
      -o /bin/graphcl

RUN apk add upx && upx -9 /bin/graphcl

FROM scratch
COPY --from=gobuilder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=gobuilder /bin/graphcl /bin/graphcl


EXPOSE 7370

ENTRYPOINT ["/bin/graphcl"]
CMD ["/bin/graphcl"]
