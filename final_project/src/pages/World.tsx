import { useLanguage } from '../i18n/LanguageContext';

export default function World() {
  const { t } = useLanguage();
  return (
    <section className="page">
      <h1>{t('world.title')}</h1>
      <p className="dim">{t('world.placeholder')}</p>
    </section>
  );
}
