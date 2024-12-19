/// <reference types="vite/client" />

/**
 * Type definitions for environment variables used in the OTPless Internal Billing System
 * @version 1.0.0
 */
interface ImportMetaEnv {
  /** Base URL for API endpoints */
  readonly VITE_API_URL: string;
  
  /** Auth0 domain for authentication */
  readonly VITE_AUTH0_DOMAIN: string;
  
  /** Auth0 client ID for application */
  readonly VITE_AUTH0_CLIENT_ID: string;
  
  /** Auth0 audience for API authorization */
  readonly VITE_AUTH0_AUDIENCE: string;
  
  /** API version for endpoint versioning */
  readonly VITE_API_VERSION: string;
  
  /** Current deployment environment */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';
  
  /** Enable debug mode flag */
  readonly VITE_ENABLE_DEBUG: boolean;
}

/**
 * Extends ImportMeta interface to include environment variables
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Static asset type declarations for supported file types
 */

// Image assets
declare module '*.svg' {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.ico' {
  const content: string;
  export default content;
}

// Style assets
declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.scss' {
  const content: string;
  export default content;
}

// Document assets
declare module '*.json' {
  const content: any;
  export default content;
}

declare module '*.pdf' {
  const content: string;
  export default content;
}

// Font assets
declare module '*.woff' {
  const content: string;
  export default content;
}

declare module '*.woff2' {
  const content: string;
  export default content;
}

declare module '*.ttf' {
  const content: string;
  export default content;
}

declare module '*.eot' {
  const content: string;
  export default content;
}