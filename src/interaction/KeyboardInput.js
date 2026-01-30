/**
 * KeyboardController - Global keyboard input handling
 *
 * Provides:
 * - Delete/Backspace to remove selected element
 * - Escape to clear selection
 * - Input field detection (don't interfere with text input)
 */
export class KeyboardController {
  constructor(selectionManager) {
    this.selectionManager = selectionManager;
    this.setupKeyboardListeners();
  }

  /**
   * Setup window-level keyboard event listeners
   */
  setupKeyboardListeners() {
    window.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });
  }

  /**
   * Handle keydown events
   */
  handleKeyDown(event) {
    // Don't interfere with text input in forms
    if (this.isTextInputActive(event.target)) {
      return;
    }

    // Delete or Backspace: remove selected element
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.selectionManager.deleteSelected();
      return;
    }

    // Escape: clear selection
    if (event.key === 'Escape') {
      this.selectionManager.clearSelection();
      return;
    }
  }

  /**
   * Check if target is a text input element
   */
  isTextInputActive(target) {
    if (!target) return false;

    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }

    // Check for contentEditable
    if (target.isContentEditable) {
      return true;
    }

    return false;
  }
}
