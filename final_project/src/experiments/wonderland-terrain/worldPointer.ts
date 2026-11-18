let hint: HTMLDivElement | null = null;
let lastX = 0;
let lastY = 0;

function moveHint(event: PointerEvent) {
  lastX = event.clientX;
  lastY = event.clientY;
  if (hint) hint.style.transform = `translate(${Math.min(lastX + 18, window.innerWidth - hint.offsetWidth - 8)}px, ${Math.min(lastY + 18, window.innerHeight - hint.offsetHeight - 8)}px)`;
}

/** Cursor state is shared by the pickable 3D resources, not by the page controls. */
export function setWorldPointer(kind: 'creature' | 'fish' | 'resource' | null) {
  if (!kind) {
    delete document.body.dataset.worldPointer;
    hint?.remove();
    hint = null;
    return;
  }
  document.body.dataset.worldPointer = kind;
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'world-pointer-hint';
    hint.setAttribute('role', 'status');
    document.body.appendChild(hint);
  }
  const zh = document.documentElement.lang.toLowerCase().startsWith('zh');
  // Every hint names what a click really does (each is tested: the creature's card, the fish's card, the atlas card).
  hint.textContent = kind === 'creature' ? (zh ? '认识白玉兽' : 'Meet the jade dweller') : kind === 'fish' ? (zh ? '认识溪灵' : 'Meet the streamling') : (zh ? '打开图鉴卡' : 'Open its atlas card');
  hint.style.transform = `translate(${Math.min(lastX + 18, window.innerWidth - hint.offsetWidth - 8)}px, ${Math.min(lastY + 18, window.innerHeight - hint.offsetHeight - 8)}px)`;
}

if (typeof document !== 'undefined') document.addEventListener('pointermove', moveHint, { passive: true });
