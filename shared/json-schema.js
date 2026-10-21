// Minimal JSON Schema validator shared by the server (Node) and the browser.
// Supports the keywords this app's contracts use: type (incl. arrays like ["integer","null"]),
// enum, const, properties, required, additionalProperties (false or a schema), items, minItems,
// maxItems, minLength, maxLength, pattern, minimum, maximum, anyOf and format.
// Keywords starting with "x-" are UI hints for the form builder and are ignored here.

const FORMATS = {
  time: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
  uri: /^https?:\/\/[^\s]+$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : Number.isFinite(value) ? "number" : "nan";
  return typeof value;
}

function matchesType(value, type) {
  const actual = typeOf(value);
  return [].concat(type).some((t) => t === actual || (t === "number" && actual === "integer"));
}

const label = (schema, path) => schema.title ?? (path || "Value");

/** Returns [] when valid, otherwise [{ path, keyword, message }]. Paths use dots: "schedule.time". */
export function validate(schema, value, path = "") {
  const errors = [];
  const fail = (keyword, message, at = path) => errors.push({ path: at, keyword, message });
  const name = label(schema, path);

  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => validate(s, value, path).length === 0);
    if (!ok) fail("anyOf", `${name} is not in an accepted form.`);
    return errors;
  }
  if (schema.type && !matchesType(value, schema.type)) {
    const want = [].concat(schema.type).filter((t) => t !== "null");
    const words = { integer: "a whole number", number: "a number", string: "text", boolean: "true or false", object: "an object", array: "a list" };
    fail("type", `${name} must be ${want.map((t) => words[t] ?? t).join(" or ")}${[].concat(schema.type).includes("null") ? " (or empty)" : ""}.`);
    return errors;
  }
  if (schema.const !== undefined && value !== schema.const) fail("const", `${name} must be ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.includes(value)) fail("enum", `${name} must be one of: ${schema.enum.join(", ")}.`);

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) fail("minLength", schema.minLength === 1 ? `${name} is required.` : `${name} needs at least ${schema.minLength} characters.`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail("maxLength", `${name} allows at most ${schema.maxLength} characters.`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail("pattern", schema["x-pattern-message"] ?? `${name} is not in the expected format.`);
    if (schema.format && FORMATS[schema.format] && !FORMATS[schema.format].test(value)) fail("format", `${name} must be a valid ${schema.format}.`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) fail("minimum", `${name} must be at least ${schema.minimum}.`);
    if (schema.maximum !== undefined && value > schema.maximum) fail("maximum", `${name} must be at most ${schema.maximum}.`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail("minItems", `${name} needs at least ${schema.minItems} item(s).`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail("maxItems", `${name} allows at most ${schema.maxItems} items.`);
    if (schema.items) value.forEach((item, i) => errors.push(...validate(schema.items, item, `${path}[${i}]`)));
  }
  if (typeOf(value) === "object") {
    const props = schema.properties ?? {};
    // An undefined property is absent, as it is once serialised to JSON.
    for (const key of schema.required ?? []) {
      if (value[key] === undefined) fail("required", `${props[key]?.title ?? key} is required.`, path ? `${path}.${key}` : key);
    }
    for (const [key, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const at = path ? `${path}.${key}` : key;
      if (props[key]) errors.push(...validate(props[key], v, at));
      else if (schema.additionalProperties === false) fail("additionalProperties", `Unexpected field "${key}".`, at);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") errors.push(...validate(schema.additionalProperties, v, at));
    }
  }
  return errors;
}

/** The same schema with nothing required, for PATCH-style partial updates. */
export function partial(schema) {
  if (schema.type !== "object" && !(Array.isArray(schema.type) && schema.type.includes("object"))) return schema;
  const { required, ...rest } = schema;
  return {
    ...rest,
    ...(schema.properties ? { properties: Object.fromEntries(Object.entries(schema.properties).map(([k, s]) => [k, partial(s)])) } : {}),
  };
}

export class SchemaError extends Error {
  constructor(errors, message = "The request did not match its schema.") {
    super(message);
    this.status = 400;
    this.code = "VALIDATION_FAILED";
    this.fields = errors;
  }
}

/** Throws SchemaError when `value` does not satisfy `schema`. */
export function assertValid(schema, value) {
  const errors = validate(schema, value);
  if (errors.length) throw new SchemaError(errors, errors.length === 1 ? errors[0].message : `${errors[0].message} (+${errors.length - 1} more)`);
  return value;
}
