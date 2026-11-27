import { backupFileName, exportBackup, importBackup, parseBackup } from './backup';

/**
 * The "Back up and restore" dialog (V1.2-02): a bottom sheet on a phone, a centred dialog on a laptop (the CSS decides).
 * Restoring asks in the dialog itself, not with confirm(). `onRestored` lets the shell redraw the current screen.
 */
export function createBackupDialog(onRestored: () => void): { open: () => void } {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.setAttribute('aria-labelledby', 'bk-title');
  dlg.innerHTML = `
    <div id="bk-main">
      <div class="p-sheet-head">
        <h2 id="bk-title">Back up and restore</h2>
        <button type="button" class="p-close" id="b-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
      </div>
      <p class="help">Save your clothes, outfits, favourite colours, colour quiz result and current look to a file. Restoring from a file replaces everything on this device.</p>
      <div class="sheet-actions">
        <button type="button" class="primary" id="b-export">Save a backup</button>
        <button type="button" class="secondary" id="b-import">Restore from file</button>
        <input type="file" id="b-file" accept="application/json,.json" hidden>
      </div>
      <p class="msg" id="b-msg" role="status"></p>
    </div>
    <div id="bk-confirm" hidden>
      <h2>Replace everything on this device with this backup?</h2>
      <div class="sheet-actions">
        <button type="button" class="primary" id="b-replace">Replace</button>
        <button type="button" class="secondary" id="b-cancel">Cancel</button>
      </div>
    </div>`;
  document.body.append(dlg);

  const $ = <T extends HTMLElement>(id: string) => dlg.querySelector<T>(id)!;
  const mainView = $('#bk-main');
  const confirmView = $('#bk-confirm');
  const msg = $('#b-msg');
  const file = $<HTMLInputElement>('#b-file');
  let pending: Record<string, unknown> | null = null;

  /** One message line. An error is ink with a "!" icon, a success has a tick, anything else is plain (E1, V10-02). */
  const say = (text: string, tone: 'ok' | 'error' | '' = '') => {
    msg.textContent = text;
    if (tone) msg.dataset.tone = tone;
    else delete msg.dataset.tone;
  };
  const showMain = () => {
    pending = null;
    confirmView.hidden = true;
    mainView.hidden = false;
  };
  dlg.addEventListener('close', () => {
    showMain();
    say('');
  });
  // A tap on the scrim (the dialog's own backdrop) closes it.
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  $('#b-close').addEventListener('click', () => dlg.close());

  $('#b-export').addEventListener('click', async () => {
    const blob = new Blob([JSON.stringify(await exportBackup(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = backupFileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say('Backup saved.', 'ok');
  });
  $('#b-import').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    const text = await f.text();
    file.value = '';
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      say(parsed.error, 'error');
      return;
    }
    pending = parsed.data;
    say('');
    mainView.hidden = true;
    confirmView.hidden = false;
    $('#b-replace').focus();
  });
  $('#b-cancel').addEventListener('click', () => {
    showMain();
    say('Restore cancelled.');
  });
  $('#b-replace').addEventListener('click', async () => {
    if (!pending) return;
    await importBackup(pending);
    showMain();
    say('Backup restored.', 'ok');
    onRestored();
  });

  return { open: () => dlg.showModal() };
}
