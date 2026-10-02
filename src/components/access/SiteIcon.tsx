import { useState } from 'react';
import { getInitials } from '../../utils/text';
import { getFaviconUrl } from '../../utils/url';

interface SiteIconProps {
  url: string;
  name: string;
  image?: string;
  size?: 'md' | 'lg';
}

export function SiteIcon({ url, name, image, size = 'md' }: SiteIconProps) {
  const [failed, setFailed] = useState(false);

  if (image) {
    return (
      <div className={`site-icon site-icon--${size} site-icon--custom`} aria-hidden="true">
        <img src={image} alt="" />
      </div>
    );
  }

  const src = getFaviconUrl(url);

  return (
    <div className={`site-icon site-icon--${size}`} aria-hidden="true">
      {src && !failed ? (
        <img src={src} alt="" width={22} height={22} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
