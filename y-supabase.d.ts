declare module "y-supabase/lib/y-supabase" {
  import type * as Y from "yjs";
  import type { SupabaseClient } from "@supabase/supabase-js";

  export interface SupabaseProviderOptions {
    channel: string;
    tableName: string;
    idName?: string;
    id: string;
    resyncInterval?: number;
    databaseDetails?: Record<string, unknown>;
  }

  export default class SupabaseProvider {
    constructor(doc: Y.Doc, supabase: SupabaseClient, options: SupabaseProviderOptions);
    awareness: unknown;
    destroy(): void;
    disconnect(): void;
    connect(): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    off(event: string, cb: (...args: unknown[]) => void): void;
  }
}
