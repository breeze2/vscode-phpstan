export function debounce(func: () => void, wait = 300) {
  let h: any;
  return () => {
    clearTimeout(h);
    h = setTimeout(() => func(), wait);
  };
}
