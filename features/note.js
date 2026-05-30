/*
 * features/note.js - the Note add/edit modal, extracted from the app.js IIFE as
 * the second feature-file split under the window.App registry pattern.
 *
 * Loaded as a classic <script src="features/note.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openNoteModal back onto App (the 5 inbound call sites in app.js call it via
 * App.openNoteModal at user-action time), and binds the modal's Cancel / Done
 * buttons at this file's load (after the DOM is parsed, equivalent to the old
 * in-IIFE binding).
 *
 * Boundary rule: all shared dependencies are read from App.* at call time
 * (never captured at load), so load order beyond "after app.js" does not matter.
 * See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  const DEFAULT_NOTE_COLOR = '#e85447';

  function openNoteModal(mode, initialText, positionOrNote) {
    const state = App.state;
    document.getElementById('noteModalTitle').textContent = mode === 'edit' ? 'Edit Note' : 'Add Note';
    document.getElementById('noteModalText').value = initialText || '';
    let currentColor;
    if (mode === 'edit') {
      currentColor = (positionOrNote && positionOrNote.color) || DEFAULT_NOTE_COLOR;
      state.editingNote = positionOrNote;
      state.pendingNote = null;
    } else {
      currentColor = state.pendingNoteColor || DEFAULT_NOTE_COLOR;
      state.pendingNote = positionOrNote;
      state.editingNote = null;
    }
    const swatchEl = document.getElementById('noteModalColorSwatch');
    if (swatchEl) {
      swatchEl.style.background = currentColor;
      swatchEl.onclick = () => {
        const color = state.editingNote ? (state.editingNote.color || DEFAULT_NOTE_COLOR) : (state.pendingNoteColor || DEFAULT_NOTE_COLOR);
        App.showLineColorModal(color, (newColor) => {
          if (state.editingNote) {
            App.pushUndoSnapshot();
            state.editingNote.color = newColor;
            App.markProjectDirty();
            App.renderPdf();
          } else {
            state.pendingNoteColor = newColor;
          }
          swatchEl.style.background = newColor;
        });
      };
    }
    App.showModal('noteModal');
    document.getElementById('noteModalText').focus();
  }

  document.getElementById('noteModalCancel').onclick = () => {
    const state = App.state;
    App.hideModal('noteModal');
    state.pendingNote = null;
    state.editingNote = null;
    state.pendingNoteColor = null;
  };

  document.getElementById('noteModalDone').onclick = () => {
    const state = App.state;
    const text = document.getElementById('noteModalText').value.trim();
    App.hideModal('noteModal');
    if (state.pendingNote) {
      if (text) {
        App.pushUndoSnapshot();
        const page = state.pages[state.currentPage];
        const canvas = page && App.ensureActiveCanvas(page);
        if (canvas) {
          if (!canvas.annotations.notes) canvas.annotations.notes = [];
          canvas.annotations.notes.push({ x: state.pendingNote.x, y: state.pendingNote.y, text, id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color: state.pendingNoteColor || DEFAULT_NOTE_COLOR });
        }
      }
      state.pendingNote = null;
      state.pendingNoteColor = null;
    } else if (state.editingNote) {
      App.pushUndoSnapshot();
      state.editingNote.text = text;
      state.editingNote = null;
    }
    App.markProjectDirty();
    App.renderPdf();
    App.updateUI();
  };

  App.openNoteModal = openNoteModal;
})();
