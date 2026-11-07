/** True on desktops/laptops. On touch devices focusing an input pops the keyboard up uninvited. */
export const canAutoFocus = typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches;
