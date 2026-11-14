import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface Slide {
  title: string;
  body: ReactNode;
}

interface Props {
  slides: Slide[];
  /** Nom del carrusel per als lectors de pantalla. */
  label: string;
}

/**
 * Unes quantes pàgines que es passen fent lliscar el dit (`scroll-snap`) o
 * tocant els punts de sota; el punt de la pàgina oberta s'allarga. És el final
 * de partida del repte i de la lliga: la primera pàgina és la principal i les
 * altres hi afegeixen informació.
 */
export function Carousel({ slides, label }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const pages = useRef<(HTMLElement | null)[]>([]);
  const [page, setPage] = useState(0);
  /*
   * L'alçada és la de la pàgina que es veu: una pàgina curta no deixa el
   * forat de la més llarga (i la resta de la finestra no baixa).
   */
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const measure = () => {
      const el = pages.current[page];
      if (el) setHeight(el.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    pages.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [page, slides.length]);

  const goTo = (index: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    setPage(index);
  };

  return (
    <div className="carrusel" role="region" aria-roledescription="carrusel" aria-label={label}>
      <div
        className="carrusel-pista"
        ref={track}
        style={height ? { height } : undefined}
        onScroll={(event) => {
          const el = event.currentTarget;
          const index = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (index !== page) setPage(Math.min(slides.length - 1, Math.max(0, index)));
        }}
      >
        {slides.map((slide, i) => (
          <section
            key={slide.title}
            ref={(el) => {
              pages.current[i] = el;
            }}
            className="carrusel-diapo"
            role="group"
            aria-roledescription="pàgina"
            aria-label={`${i + 1} de ${slides.length}: ${slide.title}`}
          >
            <h3 className="carrusel-titol">{slide.title}</h3>
            {slide.body}
          </section>
        ))}
      </div>
      <div className="carrusel-punts-nav" role="tablist" aria-label="Pàgines">
        {slides.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            role="tab"
            className="carrusel-punt"
            aria-selected={page === i}
            aria-label={`Pàgina ${i + 1}: ${slide.title}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
