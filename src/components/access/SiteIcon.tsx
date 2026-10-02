import { useState } from 'react';
import { getInitials } from '../../utils/text';
import { getFaviconUrl } from '../../utils/url';

interface SiteIconProps {
  url: string;
  name: string;
}

export function SiteIcon({ url, name }: SiteIconProps) {
  const [failed, setFailed] = useState(false);
  const src = getFaviconUrl(url);

  return (
    <div className="site-icon" aria-hidden="true">
      {src && !failed ? (
        <img src={src} alt="" width={22} height={22} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
