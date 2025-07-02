class ImageCache {
  private cache: Map<string, string>;
  
  constructor() {
    this.cache = new Map();
  }
  
  get(key: string): string | undefined {
    return this.cache.get(key);
  }
  
  set(key: string, value: string): void {
    this.cache.set(key, value);
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

export const imageUrlCache = new ImageCache();
