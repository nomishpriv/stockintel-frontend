import { useState } from 'react';

function SearchBar({ onSearch, inputRef }) {  // ← NEW: accept inputRef prop
  const [value, setValue] = useState('');

  const handleChange = (e) => {
    setValue(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <div className="search-bar">
      <input
        ref={inputRef}                          // ← NEW: attach ref for '/' shortcut
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search symbol or company name..."
        className="search-input"
      />
      {value && (
        <span className="search-clear" onClick={() => { setValue(''); onSearch(''); }}>
          ✕
        </span>
      )}
    </div>
  );
}

export default SearchBar;