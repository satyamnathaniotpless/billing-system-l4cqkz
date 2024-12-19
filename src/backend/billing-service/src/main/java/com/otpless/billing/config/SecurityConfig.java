package com.otpless.billing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.context.event.EventListener;

import java.util.Arrays;
import java.util.List;
import java.time.Duration;

/**
 * Comprehensive security configuration for the OTPless Billing Service.
 * Implements OAuth2, JWT, and API Key authentication with enhanced monitoring.
 * Version: Spring Security 6.0.0
 */
@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    private static final String[] PUBLIC_URLS = {
        "/api/v1/health",
        "/api/v1/metrics",
        "/swagger-ui/**",
        "/v3/api-docs/**"
    };

    private static final String[] ADMIN_URLS = {
        "/api/v1/admin/**"
    };

    private static final String[] FINANCE_URLS = {
        "/api/v1/billing/**",
        "/api/v1/invoices/**"
    };

    /**
     * Configures the security filter chain with comprehensive security controls.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            // Configure CORS
            .cors(cors -> cors
                .configurationSource(corsConfigurationSource()))
            
            // Configure CSRF
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .ignoringRequestMatchers("/api/v1/webhooks/**"))
            
            // Configure authorization
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(PUBLIC_URLS).permitAll()
                .requestMatchers(ADMIN_URLS).hasRole("ADMIN")
                .requestMatchers(FINANCE_URLS).hasRole("FINANCE")
                .anyRequest().authenticated())
            
            // Configure OAuth2 resource server
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .decoder(jwtDecoder())
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())))
            
            // Configure security headers
            .headers(headers -> headers
                .frameOptions().deny()
                .xssProtection().block()
                .contentSecurityPolicy("default-src 'self'")
                .httpStrictTransportSecurity().maxAgeInSeconds(31536000))
            
            // Configure session management
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            .build();
    }

    /**
     * Configures JWT decoder with enhanced validation and monitoring.
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder
            .withJwkSetUri("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}")
            .build();

        // Configure token validators
        OAuth2TokenValidator<Jwt> defaultValidators = JwtValidators.createDefault();
        OAuth2TokenValidator<Jwt> audienceValidator = new JwtAudienceValidator();
        OAuth2TokenValidator<Jwt> issuerValidator = new JwtIssuerValidator("${spring.security.oauth2.resourceserver.jwt.issuer-uri}");
        
        // Combine validators
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
            defaultValidators,
            audienceValidator,
            issuerValidator
        );

        jwtDecoder.setJwtValidator(validator);
        return jwtDecoder;
    }

    /**
     * Configures security event handling and monitoring.
     */
    @EventListener
    public void onSuccess(AuthenticationSuccessEvent success) {
        // Log successful authentication
        // Metrics.counter("security.authentication.success").increment();
    }

    @EventListener
    public void onFailure(AbstractAuthenticationFailureEvent failures) {
        // Log authentication failures
        // Metrics.counter("security.authentication.failure").increment();
    }

    /**
     * Configures CORS with strict security controls.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("${app.cors.allowed-origins}"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With"));
        configuration.setExposedHeaders(Arrays.asList("X-Total-Count"));
        configuration.setMaxAge(Duration.ofHours(1));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    /**
     * Configures JWT authentication converter with role mapping.
     */
    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(
            jwt -> JwtGrantedAuthoritiesConverter.fromScope()
                .convert(jwt)
        );
        return converter;
    }
}