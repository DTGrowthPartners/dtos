import { useEffect, useState } from 'react';

// Video de fondo para el tema Liquid Glass. Se muestra solo cuando html tiene
// la clase "liquid". Va detrás de todo (el shell es transparente) para que el
// backdrop-filter de las superficies lo difumine — así el cristal "se siente".
const VIDEO_URL = 'https://www.dtgrowthpartners.com/assets/fondo-seccion-DT-OS2-CmmkOBAs.mp4';

export default function LiquidBackground() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const update = () => setActive(html.classList.contains('liquid'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  if (!active) return null;

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
      />
      {/* Overlay para dar contraste al cristal sobre el video */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(3,8,18,0.45), rgba(3,8,18,0.62))' }}
      />
    </div>
  );
}
