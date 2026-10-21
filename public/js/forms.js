// Schema-to-form hydration and form-to-JSON serialisation. Fields are generated from the shared
// JSON Schemas (integer -> number input with step 1, enum -> select, boolean -> switch, nullable
// integer -> number input that may be left blank) and validated against the same schema the
// server enforces. Errors land in data-agent-error nodes linked with aria-describedby.
import { validate } from "/shared/json-schema.js";
import { agent, h } from "./dom.js";

const typesOf = (schema) => [].concat(schema.type ?? []);
const isGroup = (schema) => typesOf(schema).includes("object") && Boolean(schema.properties);
const escape = (s) => (globalThis.CSS?.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));

/**
 * Form controls for `schema.properties` (optionally `only` some keys). `form` is a short prefix
 * that makes ids and agent ids unique, e.g. "settings" -> id "settings-schedule-time".
 */
export function schemaFields(schema, { form, path = [], values = {}, only, labels = {} }) {
  const required = schema.required ?? [];
  return Object.entries(schema.properties ?? {})
    .filter(([key]) => !only || only.includes(key))
    .map(([key, prop]) => {
      const fieldPath = [...path, key];
      const value = values?.[key];
      if (isGroup(prop)) {
        return h(
          "fieldset",
          { class: "schema-group", "data-schema-group": fieldPath.join(".") },
          h("legend", {}, prop.title ?? key),
          schemaFields(prop, { form, path: fieldPath, values: value, labels }),
        );
      }
      return schemaField(prop, { form, fieldPath, value, required: required.includes(key), label: labels[fieldPath.join(".")] });
    });
}

function schemaField(prop, { form, fieldPath, value, required, label: labelOverride }) {
  const name = fieldPath.join(".");
  const id = `${form}-${fieldPath.join("-")}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const types = typesOf(prop);
  const nullable = types.includes("null");
  const common = {
    id,
    name,
    "aria-describedby": [prop.description ? hintId : null, errorId].filter(Boolean).join(" "),
    "data-schema-path": name,
    "data-schema-type": types.find((t) => t !== "null"),
    "data-nullable": nullable ? "true" : null,
    ...agent(`${form}_${fieldPath.join("_")}`),
  };
  const label = h("label", { for: id }, labelOverride ?? prop.title ?? fieldPath.at(-1));
  const hint = prop.description ? h("small", { id: hintId, class: "field-hint" }, prop.description) : null;
  const error = h("span", { id: errorId, class: "error-msg", "data-agent-error": name, "aria-live": "assertive" });

  if (types.includes("boolean")) {
    return h(
      "div",
      { class: "switch" },
      h("input", { ...common, type: "checkbox", role: "switch", checked: value === true }),
      h("div", { class: "switch-text" }, label, hint),
      error,
    );
  }

  let control;
  if (prop.enum) {
    control = h(
      "select",
      { ...common, required },
      prop.enum.filter((v) => v !== null).map((v) => h("option", { value: v, selected: v === value }, String(v))),
    );
  } else if (types.includes("integer") || types.includes("number")) {
    control = h("input", {
      ...common,
      type: "number",
      inputmode: "numeric",
      step: String(prop["x-step"] ?? (types.includes("integer") ? 1 : "any")),
      min: prop.minimum,
      max: prop.maximum,
      value: value ?? "",
      placeholder: prop["x-placeholder"] ?? null,
      required: required && !nullable,
    });
  } else if (prop["x-widget"] === "textarea") {
    control = h("textarea", { ...common, rows: "3", maxlength: prop.maxLength });
    control.value = value ?? "";
  } else {
    const type = { password: "password", time: "time" }[prop["x-widget"]] ?? (prop.format === "email" ? "email" : "text");
    control = h("input", {
      ...common,
      type,
      value: value ?? "",
      minlength: prop.minLength,
      maxlength: prop.maxLength,
      required,
      autocomplete: type === "password" ? "current-password" : "off",
    });
  }
  return h("div", { class: "field" }, label, control, hint, error);
}

/** A form-level error node for messages that belong to no single field. */
export const formErrorNode = (form) => h("p", { id: `${form}-form-error`, class: "error-msg form-error", "data-agent-error": "_form", "aria-live": "assertive" });

function readControl(el) {
  const type = el.dataset.schemaType;
  if (type === "boolean") return el.checked;
  if (type === "integer" || type === "number") {
    const raw = el.value.trim();
    if (raw === "") return el.dataset.nullable ? null : ""; // "" fails the type check with a clear message
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return el.value;
}

/** Form -> JSON for the fields of `schema` that are present in the form. */
export function readForm(form, schema, path = []) {
  const out = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const fieldPath = [...path, key];
    if (isGroup(prop)) {
      const nested = readForm(form, prop, fieldPath);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }
    const el = form.querySelector(`[data-schema-path="${escape(fieldPath.join("."))}"]`);
    if (el) out[key] = readControl(el);
  }
  return out;
}

/** Writes errors into the form's data-agent-error nodes; returns true when there are none. */
export function showErrors(form, errors, { only } = {}) {
  const byPath = new Map();
  for (const e of errors) if (!byPath.has(e.path)) byPath.set(e.path, e.message);
  const placed = new Set();
  for (const node of form.querySelectorAll("[data-agent-error]")) {
    const path = node.dataset.agentError;
    if (path === "_form") continue;
    if (only && !only.has(path)) continue;
    const message = byPath.get(path) ?? "";
    if (message) placed.add(path);
    node.textContent = message;
    const control = form.querySelector(`[data-schema-path="${escape(path)}"]`);
    if (control) {
      if (message) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
    }
  }
  const formNode = form.querySelector('[data-agent-error="_form"]');
  if (formNode && !only) {
    formNode.textContent = errors
      .filter((e) => !placed.has(e.path))
      .map((e) => e.message)
      .join(" ");
  }
  return errors.length === 0;
}

/** Reads and validates the form against `schema`; shows errors (only for `only` paths if given). */
export function validateForm(form, schema, { only } = {}) {
  const value = readForm(form, schema);
  const errors = validate(schema, value);
  showErrors(form, errors, { only });
  return { value, errors };
}

/** Instant validation while typing: each field reports once the user has touched it. */
export function bindLiveValidation(form, schema) {
  const touched = new Set();
  const onEdit = (event) => {
    const path = event.target.dataset?.schemaPath;
    if (!path) return;
    touched.add(path);
    validateForm(form, schema, { only: touched });
  };
  form.addEventListener("input", onEdit);
  form.addEventListener("change", onEdit);
}
