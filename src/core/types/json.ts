export type JsonPrimitive = string | number | boolean | null;

export type JsonArray = readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/**
 * Adds direct JSON-compatible extension keys without changing the serialized shape.
 * Known properties retain their precise types while unrecognized properties remain JSON-safe.
 */
export type JsonExtensible<Known extends object> = Readonly<Known> & JsonObject;

/**
 * Serialized sparse collections remain JSON extension bags at the declaration boundary.
 * Arbitrary index reads are therefore JsonValue | undefined; Task 5 parsing validates and
 * narrows non-negative decimal entries before core code treats them as Item.
 */
export type SparseJsonCollection<Known extends object = object> = Readonly<Known> & {
  readonly [key: string]: JsonValue | undefined;
};
