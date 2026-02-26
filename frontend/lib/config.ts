// VCA Frontend Configuration - Phase 2
// Centralized configuration for API and system settings

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export const CONFIG = {
  // API Configuration
  api: {
    baseUrl: API_BASE_URL,
    timeout: 30000, // 30 seconds
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
  },
  
  // Cryptography Configuration
  crypto: {
    algorithm: "Ed25519",
    hashAlgorithm: "SHA-256",
    phashAlgorithm: "dHash",
    manifestVersion: "1.1",
  },
  
  // Processing Configuration
  processing: {
    samplingIntervalSeconds: 2.0,
    maxSamples: 50,
    pollingInterval: 1000, // 1 second
  },
  
  // UI Configuration
  ui: {
    maxLogs: 100,
    signatureDisplayLength: 32,
    hashDisplayLength: 16,
  }
};

export default CONFIG;
