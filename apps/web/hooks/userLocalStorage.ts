import isServer from 'utils/isServer';


type LocalStorage = {
  usernames?: null | {
    name: string;
    id: string;
    active: boolean;
  }[];
};


function useLocalStorage() {
  const fnProxy = {
    apply(target: (...args) => unknown, _: unknown, args: unknown[]) {
      if (isServer) {
        return;
      }

      return target(...args);
    },
  };

  const proxy = <T extends object>(fn: T, handler: ProxyHandler<T>) => new Proxy<T>(fn, handler);

  function getItem<K extends keyof LocalStorage>(key: K): LocalStorage[K] {
    const val = localStorage.getItem(key);

    if (val) {
      return JSON.parse(val);
    }

    return;
  }

  function setItem<K extends keyof LocalStorage>(key: K, value: LocalStorage[K]): void {
    if (value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  function updateItem<K extends keyof LocalStorage>(key: K, cb: (val: LocalStorage[K]) => LocalStorage[K]): void {
    const cur = getItem(key);

    if (!cur) {
      return;
    }

    const next = cb(cur);
    setItem(key, next);
  }

  return {
    getItem: proxy(getItem, fnProxy),
    setItem: proxy(setItem, fnProxy),
    updateItem: proxy(updateItem, fnProxy),
  };
}

export default useLocalStorage;
