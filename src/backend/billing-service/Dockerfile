# Stage 1: Build stage
FROM maven:3.9-amazoncorretto-17 AS builder
# maven v3.9.x, Java 17

# Set working directory
WORKDIR /build

# Copy pom.xml for dependency resolution
COPY pom.xml .

# Download dependencies with parallel resolution
RUN mvn dependency:go-offline -B -T 4

# Copy source code
COPY src ./src/

# Build application with parallel builds and optimizations
RUN mvn clean package -DskipTests -T 4 \
    -Dspring.profiles.active=production \
    -Dmaven.test.skip=true \
    -Dmaven.javadoc.skip=true \
    -Dmaven.source.skip=true

# Create optimized layers
RUN mkdir -p target/dependency && (cd target/dependency; jar -xf ../*.jar)

# Stage 2: Production stage
FROM amazoncorretto:17-alpine
# amazoncorretto v17-alpine

# Add labels for container metadata
LABEL maintainer="OTPless Engineering <engineering@otpless.com>"
LABEL application="otpless-billing-service"
LABEL version="1.0.0"

# Set environment variables
ENV SPRING_PROFILES_ACTIVE=production
ENV TZ=UTC
ENV JAVA_OPTS="-XX:+UseG1GC \
    -XX:MaxGCPauseMillis=100 \
    -XX:+UseStringDeduplication \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/tmp \
    -Xms1g \
    -Xmx2g \
    -XX:+ExitOnOutOfMemoryError \
    -Djava.security.egd=file:/dev/./urandom \
    -Dfile.encoding=UTF-8"

# Create non-root user
RUN addgroup -S billing && adduser -S billing -G billing

# Create necessary directories with proper permissions
RUN mkdir -p /app /var/log/billing-service && \
    chown -R billing:billing /app /var/log/billing-service

# Set working directory
WORKDIR /app

# Copy application layers from builder stage
COPY --from=builder --chown=billing:billing /build/target/dependency/BOOT-INF/lib /app/lib
COPY --from=builder --chown=billing:billing /build/target/dependency/META-INF /app/META-INF
COPY --from=builder --chown=billing:billing /build/target/dependency/BOOT-INF/classes /app

# Set proper file permissions
RUN chmod -R 440 /app

# Switch to non-root user
USER billing

# Expose application port
EXPOSE 8080

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# Set resource constraints
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"

# Set entry point with JVM tuning
ENTRYPOINT [ "sh", "-c", "java $JAVA_OPTS org.springframework.boot.loader.JarLauncher" ]

# Default command with Spring Boot configuration
CMD ["--spring.profiles.active=${SPRING_PROFILES_ACTIVE}", "--server.port=8080"]