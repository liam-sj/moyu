var DEBUG = true;

export function setDebug(enabled) {
  DEBUG = enabled;
}

export function log(tag, msg, data) {
  if (!DEBUG) return;
  if (data !== undefined) {
    console.log('[' + tag + '] ' + msg, data);
  } else {
    console.log('[' + tag + '] ' + msg);
  }
}

export function warn(tag, msg, data) {
  if (data !== undefined) {
    console.warn('[' + tag + '] ' + msg, data);
  } else {
    console.warn('[' + tag + '] ' + msg);
  }
}

export function error(tag, msg, data) {
  if (data !== undefined) {
    console.error('[' + tag + '] ' + msg, data);
  } else {
    console.error('[' + tag + '] ' + msg);
  }
}
