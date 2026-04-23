FROM eclipse-temurin:17-jdk AS build

WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
COPY backend/build.gradle ./backend/build.gradle
COPY backend/src ./backend/src

RUN chmod +x ./gradlew && ./gradlew :backend:bootJar --no-daemon

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /workspace/backend/build/libs/*.jar /app/app.jar

ENV SPRING_PROFILES_ACTIVE=local

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]

