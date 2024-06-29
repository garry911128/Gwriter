# 使用官方的 Golang 1.21 镜像作為构建环境的基础镜像
FROM golang:1.21 as builder

# 设置工作目录为 /app，在此目录下将执行后续的 COPY 和 RUN 指令
WORKDIR /app

# 将 go.mod 和 go.sum 文件复制到容器的 /app 目录下
# 这两个文件定义了项目的依赖
COPY go.* ./

# 运行 go mod download 来下载依赖包
# 这利用了 Docker 的层缓存机制，只有当 go.mod 或 go.sum 文件改变时才重新下载依赖
RUN go mod download

# 将当前目录下的所有文件和文件夹复制到容器的 /app 目录下
COPY . .

# 编译项目，生成名为 main 的可执行文件
# 编译后的可执行文件位于 /app/main
RUN go build -o main .

# 第二阶段，使用 alpine 最新版作为基础镜像，这是一个轻量级的 Linux 发行版，用于减小最终镜像的体积
FROM alpine:latest

# 设置工作目录为 /root/，这是 Alpine 容器中的根用户目录
WORKDIR /root/

# 从构建阶段的容器中复制编译好的可执行文件 main 到当前工作目录
COPY --from=builder . /app/main

# 容器启动时执行的命令，这里是运行名为 main 的可执行文件
ENTRYPOINT ["/root/main"]
