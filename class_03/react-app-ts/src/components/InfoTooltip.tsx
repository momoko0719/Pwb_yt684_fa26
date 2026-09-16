import { useState } from 'react';

interface Props {
  text: string;
}

/** Small ⓘ icon that reveals a tooltip on hover. */
export default function InfoTooltip({ text }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="info-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="info-icon" aria-label="info">ⓘ</span>
      {visible && (
        <span className="info-bubble" role="tooltip">{text}</span>
      )}
    </span>
  );
}
