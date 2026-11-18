// A Prisma mock that checks every query against the real schema.
// If code uses a field or relation that does not exist, the test fails —
// the same mistake would crash against a real database.
const fs = require('fs');
const path = require('path');
const wasm = require('@prisma/prisma-schema-wasm');

const schema = fs.readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8');
const dmmf = JSON.parse(wasm.get_dmmf(JSON.stringify({ prismaSchema: schema })));

const models = {};
for (const m of dmmf.datamodel.models) {
  models[m.name] = {
    fields: Object.fromEntries(m.fields.map((f) => [f.name, f])),
    compoundUniques: (m.uniqueFields || []).map((u) => u.join('_')).concat(m.primaryKey ? [m.primaryKey.fields.join('_')] : []),
  };
}

const FILTER_OPS = new Set([
  'equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'endsWith', 'mode',
  'has', 'hasSome', 'hasEvery', 'isEmpty', 'search',
]);
const WRITE_OPS = new Set(['set', 'increment', 'decrement', 'multiply', 'divide', 'push']);
const RELATION_WRITE = new Set(['create', 'createMany', 'connect', 'connectOrCreate', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'set', 'disconnect']);

class SchemaError extends Error {}

function fail(msg) {
  throw new SchemaError(`Prisma schema check: ${msg}`);
}

function field(model, name, where) {
  const f = models[model].fields[name];
  if (!f) fail(`${model} has no field "${name}" (${where})`);
  return f;
}

function checkWhere(model, where, ctx = 'where') {
  if (!where || typeof where !== 'object') return;
  for (const [key, value] of Object.entries(where)) {
    if (['AND', 'OR', 'NOT'].includes(key)) {
      (Array.isArray(value) ? value : [value]).forEach((w) => checkWhere(model, w, ctx));
      continue;
    }
    if (models[model].compoundUniques.includes(key)) continue;
    const f = field(model, key, ctx);
    if (f.kind === 'object') {
      if (value === null) continue;
      const ops = Object.keys(value);
      const relOps = ['some', 'every', 'none', 'is', 'isNot'];
      if (ops.some((o) => relOps.includes(o))) {
        for (const o of ops) {
          if (!relOps.includes(o)) fail(`${model}.${key}: unknown relation filter "${o}"`);
          checkWhere(f.type, value[o], `${ctx}.${key}.${o}`);
        }
      } else {
        checkWhere(f.type, value, `${ctx}.${key}`);
      }
    } else if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      for (const op of Object.keys(value)) {
        if (!FILTER_OPS.has(op)) fail(`${model}.${key}: unknown filter "${op}"`);
      }
    }
  }
}

function checkSelectInclude(model, obj, kind) {
  if (!obj || typeof obj !== 'object') return;
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_count') {
      if (value && typeof value === 'object' && value.select) {
        for (const rel of Object.keys(value.select)) {
          if (field(model, rel, `${kind}._count`).kind !== 'object') fail(`${model}._count.${rel} is not a relation`);
        }
      }
      continue;
    }
    const f = field(model, key, kind);
    if (kind === 'include' && f.kind !== 'object') fail(`include.${key} on ${model} is not a relation`);
    if (value && typeof value === 'object') {
      if (f.kind !== 'object') fail(`${model}.${key} is not a relation but has nested options`);
      checkArgs(f.type, value);
    }
  }
}

function checkOrderBy(model, orderBy) {
  if (!orderBy) return;
  for (const item of Array.isArray(orderBy) ? orderBy : [orderBy]) {
    for (const [key, value] of Object.entries(item)) {
      const f = field(model, key, 'orderBy');
      if (f.kind === 'object' && value && typeof value === 'object') checkOrderBy(f.type, value);
    }
  }
}

function checkData(model, data, ctx = 'data') {
  if (!data) return;
  for (const item of Array.isArray(data) ? data : [data]) {
    for (const [key, value] of Object.entries(item)) {
      const f = field(model, key, ctx);
      if (f.kind === 'object') {
        if (!value || typeof value !== 'object') fail(`${model}.${key} needs a nested write object`);
        for (const [op, nested] of Object.entries(value)) {
          if (!RELATION_WRITE.has(op)) fail(`${model}.${key}: unknown relation write "${op}"`);
          if (op === 'create') checkData(f.type, nested, `${ctx}.${key}.create`);
          if (op === 'createMany') checkData(f.type, nested.data, `${ctx}.${key}.createMany`);
          if (op === 'connect') checkWhere(f.type, nested, `${ctx}.${key}.connect`);
        }
      } else if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value) && f.type !== 'Json') {
        for (const op of Object.keys(value)) if (!WRITE_OPS.has(op)) fail(`${model}.${key}: unknown update "${op}"`);
      }
      if (f.kind === 'enum' && typeof value === 'string') {
        const values = dmmf.datamodel.enums.find((e) => e.name === f.type).values.map((v) => v.name);
        if (!values.includes(value)) fail(`${model}.${key}: "${value}" is not a valid ${f.type}`);
      }
    }
  }
}

function checkArgs(model, args = {}) {
  const allowed = new Set(['where', 'data', 'include', 'select', 'orderBy', 'take', 'skip', 'distinct', 'create', 'update', 'by', '_count', 'skipDuplicates', 'cursor']);
  for (const key of Object.keys(args)) if (!allowed.has(key)) fail(`unknown argument "${key}" on ${model}`);
  if (args.select && args.include) fail(`${model}: cannot use select and include together`);
  checkWhere(model, args.where);
  checkSelectInclude(model, args.include, 'include');
  checkSelectInclude(model, args.select, 'select');
  checkOrderBy(model, args.orderBy);
  checkData(model, args.data);
  checkData(model, args.create, 'create');
  checkData(model, args.update, 'update');
  if (args.by) args.by.forEach((b) => field(model, b, 'groupBy.by'));
}

const METHODS = ['findUnique', 'findFirst', 'findMany', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'count', 'groupBy'];
const DEFAULTS = { findMany: [], groupBy: [], count: 0, createMany: { count: 0 }, updateMany: { count: 0 }, deleteMany: { count: 0 } };

function createPrismaMock() {
  const client = {};
  const inner = [];
  for (const name of Object.keys(models)) {
    const accessor = name.charAt(0).toLowerCase() + name.slice(1);
    client[accessor] = {};
    for (const method of METHODS) {
      const fallback = async () => (method in DEFAULTS ? DEFAULTS[method] : null);
      const fn = jest.fn(fallback);
      inner.push({ fn, fallback });
      const checked = jest.fn((args) => {
        checkArgs(name, args);
        return fn(args);
      });
      // Tests set results with prisma.model.method.mockResolvedValue(...)
      checked.mockResolvedValue = (v) => { fn.mockResolvedValue(v); return checked; };
      checked.mockResolvedValueOnce = (v) => { fn.mockResolvedValueOnce(v); return checked; };
      checked.mockImplementation = (impl) => { fn.mockImplementation(impl); return checked; };
      client[accessor][method] = checked;
    }
  }
  client.$transaction = jest.fn(async (ops) => (typeof ops === 'function' ? ops(client) : Promise.all(ops)));
  client.$disconnect = jest.fn();
  // Clears call history and results between tests
  client.__reset = () => {
    for (const { fn, fallback } of inner) {
      fn.mockReset();
      fn.mockImplementation(fallback);
    }
    for (const accessor of Object.keys(client)) {
      for (const method of METHODS) client[accessor]?.[method]?.mockClear?.();
    }
  };
  return client;
}

module.exports = { createPrismaMock, checkArgs, models, SchemaError };
