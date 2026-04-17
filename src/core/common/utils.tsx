let startTime: number | null = null;

export function currentTimestamp() {
  if (startTime === null) {
    startTime = Date.now();
    return 0;
  } else {
    return Date.now() - startTime;
  }
}

export function log(...args: any[]) {
  console.log(`[LOG ${new Date().toISOString()}]`, ...args);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function debounce<F extends (...args: any[]) => any>(
  func: F,
  timeout: number
): (...args: Parameters<F>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function(this: any, ...args: Parameters<F>) {
    const context = this;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(context, args);
      timeoutId = null;
    }, timeout);
  };
}

export type AtLeastOneProperty<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
