import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { resolvePrimarySpacePath } from '../lib/primarySpaceNavigation';
import RouteLoadingFallback from './RouteLoadingFallback';

export default function PrimarySpaceRedirect({
  message = '메인광장 입장 경로를 준비하고 있습니다...',
}) {
  const [targetPath, setTargetPath] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTargetPath() {
      const nextPath = await resolvePrimarySpacePath();

      if (!isMounted) {
        return;
      }

      setTargetPath(nextPath);
    }

    loadTargetPath();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!targetPath) {
    return <RouteLoadingFallback message={message} />;
  }

  return <Navigate to={targetPath} replace />;
}
