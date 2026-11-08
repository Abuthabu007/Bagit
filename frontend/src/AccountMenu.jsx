import { useState } from "react";

export default function AccountMenu({ name, items }) {
  const [open, setOpen] = useState(false);

  function chooseItem(onSelect) {
    setOpen(false);
    onSelect();
  }

  return (
    <div className={`account-menu${open ? " is-open" : ""}`}>
      <button
        className="account-menu-trigger"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement.contains(event.relatedTarget)) {
            setOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        Hi, {name}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      <nav className="account-menu-popover" aria-label="Account options">
        {items.map((item) => (
          <button
            className={item.danger ? "account-menu-item danger" : "account-menu-item"}
            key={item.label}
            type="button"
            onClick={() => chooseItem(item.onSelect)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
