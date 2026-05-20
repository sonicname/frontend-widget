// IIFE build entry: import entry.ts purely for its bootstrap side effect.
// Re-exports nothing so the IIFE wrapper never reassigns window.MyWidget.
import './entry';
