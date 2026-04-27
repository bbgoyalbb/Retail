export const dataEvents = new EventTarget();
export const invalidate = (key) => dataEvents.dispatchEvent(new Event(key));
