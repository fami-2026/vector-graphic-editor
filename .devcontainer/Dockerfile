FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ENV TZ=Asia/Novosibirsk
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt-get update && apt-get install -y curl

RUN curl -L -o act.tar.gz                                                                   \
        https://github.com/nektos/act/releases/download/v0.2.84/act_Linux_x86_64.tar.gz     \
    && tar -xf act.tar.gz -C /tmp                                                           \
    && mv /tmp/act /usr/local/bin
