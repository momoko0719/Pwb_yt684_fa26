import { useState } from 'react';
import Chronicle from './chronicle/Chronicle';
import { useLang } from './i18n';
import Pines from './Pines';

type Page = 'pines' | 'chronicle';

/** Class 07 has two assignments: switch between them at the top right. */
export default function App() {
  const { lang, setLang, t } = useLang();
  const [page, setPage] = useState<Page>('pines');
  return (
    <>
      {page === 'pines' ? <Pines /> : <Chronicle />}
      <nav className="switch">
        {(['pines', 'chronicle'] as Page[]).map((p) => (
          <button key={p} className={p === page ? 'on' : ''} onClick={() => setPage(p)}>{t(`app.${p}`)}</button>
        ))}
        <button className="lang" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{lang === 'en' ? '中' : 'EN'}</button>
      </nav>
    </>
  );
}
