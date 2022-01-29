import isServer from 'utils/isServer';


type LocalStorage = {
  name?: string | null;
  user_id?: string | null;
};


function useLocalStorage() {
  function getItem<K extends keyof LocalStorage>(key: K): LocalStorage[K] {
    if (isServer) {
      return;
    }

    return localStorage.getItem(key);
  }

  function setItem<K extends keyof LocalStorage>(key: K, value: LocalStorage[K]): void {
    if (isServer) {
      return;
    }

    if (value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  }

  return { getItem, setItem };
}

export default useLocalStorage;
