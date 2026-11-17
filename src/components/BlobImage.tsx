import { useEffect, useState } from 'react';

/**
 * Shows a Blob. The object URL is created once per item id and revoked only on unmount,
 * so list refreshes (new Blob instances from IndexedDB) don't churn or break the <img>.
 */
export function BlobImage({ id, blob, alt, className }: { id: string; blob: Blob; alt: string; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- photo never changes for a given id
  }, [id]);
  return url ? <img className={className} src={url} alt={alt} /> : null;
}
