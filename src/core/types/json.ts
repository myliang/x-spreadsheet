export type JsonPrimitive = string | number | boolean | null;

export type JsonArray = readonly JsonValue[];

export type JsonObject = {
  readonly [key: string]: JsonValue;
};

export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/**
 * Adds direct JSON-compatible extension keys without changing the serialized shape.
 * Known properties retain their precise types while unrecognized properties remain JSON-safe.
 */
export type JsonExtensible<Known extends object> = Readonly<Known> & JsonObject;

export type SparseJsonCollection<Item extends JsonObject, Known extends object = object> =
  JsonExtensible<Known> & {
    readonly [index: `${bigint}`]: Item;
  };
