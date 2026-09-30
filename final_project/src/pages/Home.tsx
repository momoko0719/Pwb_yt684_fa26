import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

export default function Home() {
  const { t } = useLanguage();
  return (
    <section className="page home">
      <h1>{t('site.title')}</h1>
      <p>{t('home.tagline')}</p>
      <Link className="seal" to="/atlas">{t('home.enter')}</Link>
    </section>
  );
}
