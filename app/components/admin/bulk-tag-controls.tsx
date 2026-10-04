/** The tag field and its Add and Remove submits, for a bulk bar inside the selection's form. */
export function BulkTagControls({ listId, options }: { listId: string; options: string[] }) {
  return (
    <>
      <span className="cap-bulk-field">
        <label htmlFor={`${listId}-field`}>Tag</label>
        <input
          id={`${listId}-field`}
          className="cap-input"
          type="text"
          name="tag"
          list={listId}
          autoComplete="off"
          placeholder="tag name"
        />
      </span>
      <datalist id={listId}>
        {options.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <button type="submit" name="intent" value="bulk-add-tag" className="cap-btn">
        Add tag
      </button>
      <button type="submit" name="intent" value="bulk-remove-tag" className="cap-btn">
        Remove tag
      </button>
    </>
  );
}
