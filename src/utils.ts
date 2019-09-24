export function debounce<F extends (...params: any[]) => void>(
  fn: F,
  delay: number
) {
  let timeoutID: NodeJS.Timer;
  const wrapper = function(this: any, ...args: any[]) {
    if (!this && !args.length) {
      return;
    }
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => fn.apply(this, args), delay);
  } as F;
  return wrapper;
}
