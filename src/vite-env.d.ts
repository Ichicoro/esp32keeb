/// <reference types="svelte" />
/// <reference types="vite/client" />

interface Navigator {
  keyboard?: {
    // Define the properties/methods you use on navigator.keyboard here
    lock?: (layout?: string) => Promise<void>;
    unlock?: () => Promise<void>;
    getLayoutMap?: () => Promise<Map<string, string>>;
  };
}