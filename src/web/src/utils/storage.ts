// @version: crypto-js@4.x
import CryptoJS from 'crypto-js';
import { ApiError } from '../types/api';

/**
 * Storage type enum for browser storage selection
 */
export enum StorageType {
  LOCAL = 'local',
  SESSION = 'session'
}

/**
 * Data classification levels based on security requirements
 */
export enum DataClassification {
  CRITICAL = 'critical',
  SENSITIVE = 'sensitive',
  INTERNAL = 'internal',
  PUBLIC = 'public'
}

/**
 * Interface for items stored in browser storage
 */
export interface StorageItem<T = any> {
  value: T;
  timestamp: number;
  encrypted: boolean;
  expiresAt: number | null;
  classification: DataClassification;
}

// Constants
const STORAGE_ENCRYPTION_KEY = process.env.VITE_STORAGE_ENCRYPTION_KEY as string;
const STORAGE_PREFIX = 'otpless_';
const DEFAULT_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const STORAGE_QUOTA_LIMIT = 5 * 1024 * 1024; // 5MB limit
const COMPRESSION_THRESHOLD = 1024; // 1KB

/**
 * Storage utility class implementing secure storage operations
 */
class SecureStorage {
  private getStorage(type: StorageType): Storage {
    return type === StorageType.LOCAL ? localStorage : sessionStorage;
  }

  /**
   * Encrypts data based on classification level
   */
  private encrypt(data: string, classification: DataClassification): string {
    if (classification === DataClassification.PUBLIC) {
      return data;
    }

    if (!STORAGE_ENCRYPTION_KEY) {
      throw new Error('Storage encryption key not configured');
    }

    return CryptoJS.AES.encrypt(data, STORAGE_ENCRYPTION_KEY).toString();
  }

  /**
   * Decrypts encrypted data
   */
  private decrypt(data: string): string {
    if (!STORAGE_ENCRYPTION_KEY) {
      throw new Error('Storage encryption key not configured');
    }

    const bytes = CryptoJS.AES.decrypt(data, STORAGE_ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Compresses data if it exceeds threshold
   */
  private compress(data: string): string {
    if (data.length < COMPRESSION_THRESHOLD) {
      return data;
    }
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
  }

  /**
   * Decompresses compressed data
   */
  private decompress(data: string): string {
    try {
      return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(data));
    } catch {
      return data;
    }
  }

  /**
   * Checks if storage quota is available
   */
  public checkStorageQuota(storage: StorageType): boolean {
    try {
      const store = this.getStorage(storage);
      let totalSize = 0;
      
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key) {
          totalSize += (store.getItem(key) || '').length;
        }
      }

      return totalSize < STORAGE_QUOTA_LIMIT;
    } catch (error) {
      console.error('Storage quota check failed:', error);
      return false;
    }
  }

  /**
   * Stores an item with encryption and expiration
   */
  public setItem<T>(
    key: string,
    value: T,
    classification: DataClassification,
    storage: StorageType = StorageType.LOCAL,
    expiresIn: number | null = DEFAULT_EXPIRATION
  ): void {
    try {
      if (!this.checkStorageQuota(storage)) {
        throw new Error('Storage quota exceeded');
      }

      const store = this.getStorage(storage);
      const storageKey = STORAGE_PREFIX + key;
      const timestamp = Date.now();
      const expiresAt = expiresIn ? timestamp + expiresIn : null;

      const storageItem: StorageItem<T> = {
        value,
        timestamp,
        encrypted: classification !== DataClassification.PUBLIC,
        expiresAt,
        classification
      };

      let serializedData = JSON.stringify(storageItem);
      
      if (storageItem.encrypted) {
        serializedData = this.encrypt(serializedData, classification);
      }

      serializedData = this.compress(serializedData);
      store.setItem(storageKey, serializedData);

      // Emit storage change event
      window.dispatchEvent(new StorageEvent('storage', {
        key: storageKey,
        newValue: serializedData,
        storageArea: store
      }));
    } catch (error) {
      console.error('Storage setItem failed:', error);
      throw new Error('Failed to store item');
    }
  }

  /**
   * Retrieves and decrypts an item from storage
   */
  public getItem<T>(key: string, storage: StorageType = StorageType.LOCAL): T | null {
    try {
      const store = this.getStorage(storage);
      const storageKey = STORAGE_PREFIX + key;
      const data = store.getItem(storageKey);

      if (!data) {
        return null;
      }

      const decompressedData = this.decompress(data);
      let storageItem: StorageItem<T>;

      try {
        storageItem = JSON.parse(decompressedData) as StorageItem<T>;
      } catch {
        // If parsing fails, try decrypting first
        const decryptedData = this.decrypt(decompressedData);
        storageItem = JSON.parse(decryptedData) as StorageItem<T>;
      }

      // Check expiration
      if (storageItem.expiresAt && storageItem.expiresAt < Date.now()) {
        this.removeItem(key, storage);
        return null;
      }

      return storageItem.value;
    } catch (error) {
      console.error('Storage getItem failed:', error);
      return null;
    }
  }

  /**
   * Removes an item from storage
   */
  public removeItem(key: string, storage: StorageType = StorageType.LOCAL): void {
    try {
      const store = this.getStorage(storage);
      const storageKey = STORAGE_PREFIX + key;
      store.removeItem(storageKey);

      // Emit storage change event
      window.dispatchEvent(new StorageEvent('storage', {
        key: storageKey,
        newValue: null,
        storageArea: store
      }));
    } catch (error) {
      console.error('Storage removeItem failed:', error);
      throw new Error('Failed to remove item');
    }
  }

  /**
   * Clears all items from specified storage
   */
  public clear(storage: StorageType = StorageType.LOCAL): void {
    try {
      const store = this.getStorage(storage);
      
      // Only clear items with our prefix
      const prefixedKeys = Object.keys(store).filter(key => 
        key.startsWith(STORAGE_PREFIX)
      );

      prefixedKeys.forEach(key => store.removeItem(key));

      // Emit storage clear event
      window.dispatchEvent(new StorageEvent('storage', {
        key: null,
        newValue: null,
        storageArea: store
      }));
    } catch (error) {
      console.error('Storage clear failed:', error);
      throw new Error('Failed to clear storage');
    }
  }
}

// Export singleton instance
export const storage = new SecureStorage();