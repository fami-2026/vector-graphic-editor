FROM gradle:8.14-jdk21 AS build

WORKDIR /app
COPY ./settings.gradle .
COPY ./build.gradle .
COPY ./gradle ./gradle
COPY ./src ./src

RUN gradle --no-daemon bootJar

FROM eclipse-temurin:21-jre-jammy

WORKDIR /workspace
COPY ./plugins ./plugins
COPY --from=build /app/build/libs/vge-server.jar vge-server.jar

RUN apt-get update && apt-get install -y python3 python3-pip

ENV PLUGINS_PATH=/workspace/plugins
CMD ["java", "-jar", "vge-server.jar"]
