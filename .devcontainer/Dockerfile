FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ENV TZ=Asia/Novosibirsk
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

ARG JAVA_VERSION=21
ARG PYTHON_VERSION=3.12

RUN apt-get update && apt-get install -y \
    openjdk-${JAVA_VERSION}-jdk \
    python${PYTHON_VERSION} \
    curl \
    unzip

RUN curl -1sLf https://dl.cloudsmith.io/public/task/task/setup.deb.sh | bash \
    && apt-get install -y task

RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash \
    && apt-get install -y nodejs

RUN ln -s /usr/bin/python3.12 /usr/local/bin/python
