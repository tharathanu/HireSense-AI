import { useEffect, useState } from 'react';
import api, { readError } from '../api/client';

// Loads the real counts for a dashboard from the API
export default function useDashboardStats(role) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/dashboard/${role}`)
      .then((res) => setStats(res.data))
      .catch((err) => setError(readError(err).message));
  }, [role]);

  return { stats, error };
}
