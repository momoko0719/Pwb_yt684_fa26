import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { StringKey } from '../../i18n/strings';
import { CreatureThumb, type Antlers, type DwellingStats } from './creature';
import { traitWord } from './dwellerNames';
import type { Traits } from './dwelling';
import { NEEDS } from './dwelling';
import { FishPreview } from './FishSchool';
import { fill, LifeCard, needTone, type LifeNeed } from './LifeCard';
import { FISH_RULES, type StreamFishData } from './streamFish';

const ORDER = ['good', 'ok', 'low', 'critical'] as const;

/** The mood word from the lowest need (as The Sims' plumbob takes the lowest need's colour). */
function moodOf(needs: LifeNeed[], t: (k: StringKey) => string) {
  let worst = needs[0], tone = needTone(worst.value, worst.act);
  for (const n of needs) {
    const nt = needTone(n.value, n.act);
    if (ORDER.indexOf(nt) > ORDER.indexOf(tone) || (nt === tone && n.value - n.act < worst.value - worst.act)) { worst = n; tone = nt; }
  }
  // A need is only named once it is past its mark, i.e. once it is acting on it.
  if (tone === 'good' || tone === 'ok') return { word: t('life.mood.settled'), tone };
  return { word: t(`life.mood.${worst.key}` as StringKey), tone };
}

/** The jade dweller's card: its three needs, each with the threshold its sim acts on (NEEDS.seek). */
/** `who`: its seeded name (and what it means), character and antlers; `onNext`: on to the next creature. */
export function CreatureStatusDock({ stats, onClose, onForm, who, onNext }: { stats: DwellingStats; onClose: () => void; onForm: () => void; who?: { name: string; gloss: string; traits: Traits; antlers: Antlers }; onNext?: () => void }) {
  const { t } = useLanguage();
  const needs: LifeNeed[] = [
    { key: 'food', label: t('life.food'), icon: 'food', value: stats.needs.hunger, act: NEEDS.seek.hunger, actNote: t('life.act.food') },
    { key: 'water', label: t('life.water'), icon: 'water', value: stats.needs.thirst, act: NEEDS.seek.thirst, actNote: t('life.act.water') },
    { key: 'rest', label: t('life.rest'), icon: 'rest', value: stats.needs.energy, act: NEEDS.seek.energy, actNote: t('life.act.rest') },
  ];
  return (
    <LifeCard
      portrait={<CreatureThumb compact portrait antlers={who?.antlers} />}
      kicker={who ? t('life.dwellerNamed').replace('{n}', who.name) : t('life.dweller')}
      kickerNote={who?.gloss}
      traits={who ? (['roam', 'bold'] as const).map((k) => ({ word: t(`trait.${k}.${traitWord(who.traits[k])}` as StringKey), note: t(`trait.${k}.note` as StringKey).replace('{v}', who.traits[k].toFixed(2)) })) : undefined}
      onNext={onNext}
      action={t(`life.do.${stats.activity}` as StringKey)}
      // Where it is going is in the thought bubble above it, not repeated here.
      intent=""
      mood={moodOf(needs, t)}
      needs={needs}
      onForm={onForm}
      onClose={onClose}
    />
  );
}

/** A streamling's card: the same card; its one need, stamina, with its two marks (FISH_RULES' hold and explore). */
export function FishStatusDock({ fish, onClose, onForm, inline = false }: { fish: StreamFishData; onClose?: () => void; onForm?: () => void; inline?: boolean }) {
  const { t } = useLanguage();
  // The fish's state lives on the object its frame loop mutates; read it again a few times a second.
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 400); return () => clearInterval(id); }, []);
  const needs: LifeNeed[] = [
    { key: 'stamina', label: t('life.stamina'), icon: 'stamina', value: fish.energy, act: FISH_RULES.hold, actNote: t('life.act.stamina'), high: { at: FISH_RULES.explore, note: t('life.high.stamina') } },
  ];
  return (
    <LifeCard
      portrait={inline ? undefined : <FishPreview fish={fish} compact />}
      kicker={fill(t, 'life.fish', fish.id)}
      action={t(`life.fish.${fish.state}` as StringKey)}
      intent={t(`life.fish.go.${fish.state}` as StringKey)}
      mood={moodOf(needs, t)}
      needs={needs}
      onForm={onForm}
      onClose={onClose}
      inline={inline}
    />
  );
}
