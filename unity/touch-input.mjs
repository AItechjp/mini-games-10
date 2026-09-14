// Pointer ownership keeps simultaneous movement, aiming and action presses independent.
export function attachTouchInput({buttons, look, send, isActive}) {
  const held = new Map();
  const current = new Map();
  let aiming;
  const publish = key => {
    const value = Math.max(-1, Math.min(1, [...held.values()]
      .filter(input => input.key === key).reduce((sum, input) => sum + input.value, 0)));
    if (current.get(key) !== value) { current.set(key, value); send('Control', `${key}:${value}`); }
  };
  const release = event => {
    const input = held.get(event.pointerId);
    if (!input) return;
    held.delete(event.pointerId);
    publish(input.key);
  };
  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (!isActive() || (event.button != null && event.button !== 0) || held.has(event.pointerId)) return;
      const [key, raw] = button.dataset.input.split(':');
      const value = Number(raw);
      if (!key || !Number.isFinite(value)) return;
      event.preventDefault();
      held.set(event.pointerId, {key, value, button});
      try { button.setPointerCapture(event.pointerId); } catch { /* A cancelled pointer is released below. */ }
      publish(key);
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, release);
  }
  if (look) {
    look.addEventListener('pointerdown', event => {
      if (!isActive() || aiming || (event.button != null && event.button !== 0)) return;
      event.preventDefault();
      aiming = {id:event.pointerId, x:event.clientX, y:event.clientY};
      try { look.setPointerCapture(event.pointerId); } catch { aiming = undefined; }
    });
    look.addEventListener('pointermove', event => {
      if (!aiming || aiming.id !== event.pointerId || !isActive()) return;
      send('Control', `lookx:${event.clientX - aiming.x}`);
      send('Control', `looky:${aiming.y - event.clientY}`);
      aiming.x = event.clientX;
      aiming.y = event.clientY;
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) look.addEventListener(type, event => {
      if (aiming?.id === event.pointerId) aiming = undefined;
    });
  }
  return {
    reset() {
      const inputs = [...held.entries()];
      const aimId = aiming?.id;
      held.clear();
      aiming = undefined;
      for (const key of current.keys()) publish(key);
      for (const [id, input] of inputs) {
        try { input.button.releasePointerCapture(id); } catch { /* Capture may already be gone. */ }
      }
      if (aimId != null) { try { look.releasePointerCapture(aimId); } catch { /* Already released. */ } }
    }
  };
}
