import Markdown from 'react-markdown';
import { useLanguage } from '../i18n/LanguageContext';
import en from '../content/ideas.en.md?raw';
import zh from '../content/ideas.zh.md?raw';
import fiveIslands from '../content/ideas/five-islands.webp';
import moodboard from '../content/ideas/moodboard.webp';
import poolsIsland from '../content/ideas/pools-island.webp';
import terracesIsland from '../content/ideas/terraces-island.webp';

const CONTENT = { en, zh };

/** Images the Markdown refers to by file name. They are concept art and references, not world content. */
const IMAGES: Record<string, string> = {
  'five-islands.webp': fiveIslands,
  'moodboard.webp': moodboard,
  'pools-island.webp': poolsIsland,
  'terraces-island.webp': terracesIsland,
};

export default function Ideas() {
  const { language } = useLanguage();
  return (
    <article className="page prose ideas">
      <Markdown
        components={{
          img: ({ src, alt }) => <img src={IMAGES[String(src)] ?? String(src)} alt={alt ?? ''} loading="lazy" />,
          a: ({ href, children }) => (
            <a href={href} {...(href?.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</a>
          ),
        }}
      >
        {CONTENT[language]}
      </Markdown>
    </article>
  );
}
