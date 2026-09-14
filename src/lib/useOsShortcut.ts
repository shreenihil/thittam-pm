'use client';

import { useState, useEffect } from 'react';

export function useOsShortcut() {
  const [isApple, setIsApple] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl+K');
  const [modifierKey, setModifierKey] = useState('Ctrl');

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const platform = (navigator as any)?.userAgentData?.platform || navigator?.platform || navigator?.userAgent || '';
      const isMacOrIOS = /mac|iphone|ipad|ipod/i.test(platform);
      setIsApple(isMacOrIOS);
      setShortcutLabel(isMacOrIOS ? '⌘K' : 'Ctrl+K');
      setModifierKey(isMacOrIOS ? '⌘' : 'Ctrl');
    }
  }, []);

  return { isApple, shortcutLabel, modifierKey };
}
