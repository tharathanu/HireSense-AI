import { useCallback, useEffect, useState } from 'react';
import api, { readError } from '../api/client';

// Loads data from a GET endpoint. `reload()` fetches it again.
export default function useApi(path, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(path);
      setData(res.data);
    } catch (err) {
      setError(readError(err).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (!skip) load();
  }, [load, skip]);

  return { data, loading, error, reload: load, setData };
}
