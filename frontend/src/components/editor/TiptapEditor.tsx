// frontend/src/components/editor/TiptapEditor.tsx

import React from "react";
import { Editor } from "@tiptap/react";

// 1. Movemos o SmileyIcon para cá
export const SmileyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
    <line x1="9" y1="9" x2="9.01" y2="9"></line>
    <line x1="15" y1="9" x2="15.01" y2="9"></line>
  </svg>
);

// 2. Movemos a TiptapMenuBar para cá
export const TiptapMenuBar: React.FC<{
  editor: Editor | null;
  onEmojiToggle: (event: React.MouseEvent) => void;
}> = ({ editor, onEmojiToggle }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-menu-bar">
      <div className="emoji-picker-wrapper-in-menu">
        <button
          className="emoji-toggle-button"
          type="button"
          onClick={onEmojiToggle}
        >
          <SmileyIcon />
        </button>
      </div>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive("bold") ? "is-active" : ""}
      >
        Negrito
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive("italic") ? "is-active" : ""}
      >
        Itálico
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive("orderedList") ? "is-active" : ""}
      >
        Lista Numerada
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive("bulletList") ? "is-active" : ""}
      >
        Lista Pontuada
      </button>
    </div>
  );
};
