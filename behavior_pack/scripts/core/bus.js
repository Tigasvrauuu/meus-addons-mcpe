// core/bus.js — tiny synchronous event bus used to decouple systems
// (e.g. traversal/combat/gadgets emit progression events; challenges.js
// subscribes). Subscriptions are registered once at init (spec §4.4).

const handlers = new Map(); // topic -> Set<fn>

export function on(topic, fn) {
  if (typeof fn !== "function") return () => {};
  let set = handlers.get(topic);
  if (!set) {
    set = new Set();
    handlers.set(topic, set);
  }
  set.add(fn);
  return () => set.delete(fn);
}

export function off(topic, fn) {
  handlers.get(topic)?.delete(fn);
}

/** Emits to all handlers; a throwing handler never breaks the emitter. */
export function emit(topic, payload) {
  const set = handlers.get(topic);
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try {
      fn(payload);
    } catch {
      // A broken subscriber must not cascade; logger handles its own errors.
    }
  }
}

export function handlerCount(topic) {
  return handlers.get(topic)?.size ?? 0;
}

/** Test/maintenance helper: drop every subscription (used by tests only). */
export function clearAll() {
  handlers.clear();
}
